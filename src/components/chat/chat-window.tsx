"use client";

import * as React from "react";

import { ChatInput } from "@/components/chat/chat-input";
import { MessageList } from "@/components/chat/message-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { clearConversation, createConversation } from "@/lib/chat/actions";
import {
  ACTION_MARKER,
  parseActionEnvelope,
  safeRenderLength,
  type ChatMessage,
} from "@/lib/chat/types";

type ChatWindowProps = {
  conversationId: string | null;
  initialMessages: ChatMessage[];
};

type Status = "idle" | "streaming" | "error";

const GENERIC_ERROR = "Something went wrong. Please try again.";

function tempId(): string {
  return crypto.randomUUID();
}

/**
 * Client orchestrator for the chat. Holds the live message list (seeded once
 * from the server), streams replies from POST /api/chat, and drives the
 * new / clear / retry / stop controls. The server persists messages; this
 * component only mirrors them for the current view.
 */
export function ChatWindow({
  conversationId,
  initialMessages,
}: ChatWindowProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [convId, setConvId] = React.useState<string | null>(conversationId);
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const {
    state: speechState,
    speakingMessageId,
    error: speechError,
    isSupported: speechSupported,
    speak: speakMessage,
    stop: stopSpeaking,
  } = useSpeechSynthesis();

  const streaming = status === "streaming";

  const runStream = React.useCallback(
    async (opts: { content: string | null }) => {
      // A new assistant response is about to start — never let a previous
      // message keep speaking underneath it.
      stopSpeaking();
      setError(null);
      setStatus("streaming");

      const assistantId = tempId();
      setMessages((prev) => {
        const withUser =
          opts.content !== null
            ? [
                ...prev,
                {
                  id: tempId(),
                  role: "user" as const,
                  content: opts.content,
                },
              ]
            : prev;
        return [
          ...withUser,
          { id: assistantId, role: "assistant" as const, content: "" },
        ];
      });

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            opts.content !== null
              ? { conversationId: convId, content: opts.content }
              : { conversationId: convId },
          ),
          signal: controller.signal,
        });

        // The conversation id is returned even on error responses.
        const returnedId = response.headers.get("X-Conversation-Id");
        if (returnedId) setConvId(returnedId);

        if (!response.ok || !response.body) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? GENERIC_ERROR);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        // -1 until the marker is found; a stream chunk can split the marker
        // itself, so the tail of `accumulated` is held back from rendering
        // whenever it might be an in-progress prefix of it.
        let markerIndex = -1;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });

          if (markerIndex === -1) {
            markerIndex = accumulated.indexOf(ACTION_MARKER);
          }

          const visible =
            markerIndex === -1
              ? accumulated.slice(
                  0,
                  safeRenderLength(accumulated, ACTION_MARKER),
                )
              : accumulated.slice(0, markerIndex);

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: visible }
                : message,
            ),
          );
        }

        if (markerIndex !== -1) {
          const actions = parseActionEnvelope(
            accumulated.slice(markerIndex + ACTION_MARKER.length),
          );
          if (actions && actions.length > 0) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId ? { ...message, actions } : message,
              ),
            );
          }
        }

        setStatus("idle");
      } catch (caught) {
        // Drop an empty placeholder bubble; keep any partial text that streamed.
        setMessages((prev) =>
          prev.filter(
            (message) =>
              !(message.id === assistantId && message.content.length === 0),
          ),
        );
        if (caught instanceof Error && caught.name === "AbortError") {
          setStatus("idle");
          return;
        }
        setStatus("error");
        setError(caught instanceof Error ? caught.message : GENERIC_ERROR);
      } finally {
        abortRef.current = null;
      }
    },
    [convId, stopSpeaking],
  );

  function handleSend(text: string) {
    void runStream({ content: text });
  }

  function handleRetry() {
    // Remove the failed assistant partial, then regenerate (no re-insert).
    setMessages((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].role === "assistant") {
        return prev.slice(0, -1);
      }
      return prev;
    });
    void runStream({ content: null });
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  async function handleNew() {
    if (streaming) return;
    stopSpeaking();
    const id = await createConversation();
    setConvId(id);
    setMessages([]);
    setError(null);
    setStatus("idle");
  }

  async function handleClear() {
    if (streaming) return;
    stopSpeaking();
    if (convId) {
      const formData = new FormData();
      formData.set("conversationId", convId);
      await clearConversation(formData);
    }
    setMessages([]);
    setError(null);
    setStatus("idle");
  }

  return (
    <div className="border-border/60 bg-card flex h-[70dvh] min-h-96 flex-col rounded-2xl border shadow-sm dark:shadow-none">
      <div className="border-border/60 flex items-center justify-between border-b px-5 py-4">
        <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Assistant
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNew}
            disabled={streaming}
          >
            New
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={streaming || messages.length === 0}
          >
            Clear chat
          </Button>
        </div>
      </div>

      <MessageList
        messages={messages}
        streaming={streaming}
        conversationId={convId}
        speechState={speechState}
        speakingMessageId={speakingMessageId}
        speechError={speechError}
        speechSupported={speechSupported}
        onReadAloud={speakMessage}
        onStopSpeaking={stopSpeaking}
      />

      {status === "error" && error ? (
        <div className="border-border/60 border-t px-4 py-2">
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {streaming ? (
        <div className="border-border/60 flex justify-end border-t px-4 py-2">
          <Button variant="ghost" size="sm" onClick={handleStop}>
            Stop
          </Button>
        </div>
      ) : null}

      <ChatInput disabled={streaming} onSend={handleSend} />
    </div>
  );
}
