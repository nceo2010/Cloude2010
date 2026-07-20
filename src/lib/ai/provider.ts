/**
 * Provider-agnostic chat interface. The rest of the app depends only on these
 * types — never on a specific SDK — so the AI provider can be swapped by adding
 * a new implementation (see `anthropic.ts`) without touching callers.
 */

/** A single turn in the model conversation. */
export type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

export type StreamChatParams = {
  /** System prompt (personality + any injected context). */
  system: string;
  /** Conversation turns, oldest first, already trimmed to the context window. */
  messages: AiMessage[];
  /** Optional abort signal so the caller can cancel an in-flight stream. */
  signal?: AbortSignal;
};

export interface ChatProvider {
  /** Stream the assistant's reply as incremental text chunks. */
  streamChat(params: StreamChatParams): AsyncIterable<string>;
}
