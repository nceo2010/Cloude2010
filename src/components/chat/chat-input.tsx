"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatInputProps = {
  disabled: boolean;
  onSend: (text: string) => void;
};

/** Message composer. Enter sends; Shift+Enter inserts a newline. */
export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = React.useState("");

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled}
          aria-label="Message"
          placeholder="Send a message…  (Enter to send, Shift+Enter for a new line)"
          className={cn(
            "border-input bg-background max-h-40 flex-1 resize-none rounded-md border px-3 py-2 text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <Button
          type="button"
          onClick={submit}
          disabled={disabled || value.trim().length === 0}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
