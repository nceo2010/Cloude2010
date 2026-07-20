"use client";

import * as React from "react";

import { ChatInput } from "@/components/chat/chat-input";
import { MessageList } from "@/components/chat/message-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { clearConversation, createConversation } from "@/lib/chat/actions";
import type { ChatMessage } from "@/lib/chat/types";

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

  const streaming = status === "streaming";

  const runStream = React.useCallback(
    async (opts: { content: string | null }) => {
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
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: accumulated }
                : message,
            ),
          );
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
    [convId],
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
    const id = await createConversation();
    setConvId(id);
    setMessages([]);
    setError(null);
    setStatus("idle");
  }

  async function handleClear() {
    if (streaming) return;
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
    <div className="bg-card flex h-[70dvh] min-h-96 flex-col rounded-lg border">
      <div className="flex items-center justify-between border-b p-3">
        <span className="text-sm font-medium">Assistant</span>
        <div className="flex gap-2">
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
            Clear
          </Button>
        </div>
      </div>

      <MessageList messages={messages} streaming={streaming} />

      {status === "error" && error ? (
        <div className="border-t px-4 py-2">
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
        <div className="flex justify-end border-t px-4 py-2">
          <Button variant="ghost" size="sm" onClick={handleStop}>
            Stop
          </Button>
        </div>
      ) : null}

      <ChatInput disabled={streaming} onSend={handleSend} />
    </div>
  );
}
