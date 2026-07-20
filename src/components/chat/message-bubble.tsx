import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

/** A single chat message. Assistant bubbles show "Thinking…" until the first
 *  streamed token arrives. */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const text =
    message.content.length > 0
      ? message.content
      : isUser
        ? ""
        : "Thinking…";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap sm:max-w-[75%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground border",
        )}
      >
        {text}
      </div>
    </div>
  );
}
