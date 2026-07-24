"use client";

import * as React from "react";

import { MessageBubble } from "@/components/chat/message-bubble";
import { EmptyState } from "@/components/ui/empty-state";
import type { SpeechSynthesisState } from "@/hooks/use-speech-synthesis";
import type { ChatMessage } from "@/lib/chat/types";

type MessageListProps = {
  messages: ChatMessage[];
  streaming: boolean;
  /** Threaded down to each MessageBubble for memory_save_confirm's conversationId field. */
  conversationId: string | null;
  speechState: SpeechSynthesisState;
  speakingMessageId: string | null;
  speechError: string | null;
  speechSupported: boolean;
  onReadAloud: (messageId: string, text: string) => void;
  onStopSpeaking: () => void;
};

/** Scrollable message area. Auto-scrolls to the newest content as it streams. */
export function MessageList({
  messages,
  streaming,
  conversationId,
  speechState,
  speakingMessageId,
  speechError,
  speechSupported,
  onReadAloud,
  onStopSpeaking,
}: MessageListProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming]);

  return (
    <div className="flex-1 overflow-y-auto p-5 sm:p-6">
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            title="Start a conversation"
            description="Ask about your goal or anything on your mind. The assistant is honest and practical — and won't pretend to be your therapist."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isStreamingMessage={
                streaming &&
                index === messages.length - 1 &&
                message.role === "assistant"
              }
              conversationId={conversationId}
              speechSupported={speechSupported}
              speechState={speechState}
              speakingMessageId={speakingMessageId}
              speechError={speechError}
              onReadAloud={onReadAloud}
              onStopSpeaking={onStopSpeaking}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
