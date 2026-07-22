import type { JourneySuggestionField } from "@/lib/journeys/types";

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

/**
 * A Journey-field change proposed by the model via a tool call — untrusted
 * and unvalidated against the database. Never applied automatically; the
 * caller must enrich it with server-known facts (journeyId, oldValue) and the
 * user must explicitly accept it before anything is written.
 */
export type JourneySuggestionProposal = {
  field: JourneySuggestionField;
  suggestedValue: string;
};

/** A proposal enriched with facts read from the server-loaded Journey. */
export type JourneySuggestion = JourneySuggestionProposal & {
  journeyId: string;
  oldValue: string | number | null;
};

export type StreamChatParams = {
  /** System prompt (personality + any injected context). */
  system: string;
  /** Conversation turns, oldest first, already trimmed to the context window. */
  messages: AiMessage[];
  /** Optional abort signal so the caller can cancel an in-flight stream. */
  signal?: AbortSignal;
  /**
   * Offer the model a tool to propose one Journey-field update. Pass true
   * only when the user has an active Journey to propose changes to.
   */
  allowJourneySuggestion?: boolean;
};

export type ChatStreamResult = {
  /** The assistant's reply as incremental text chunks — unchanged from before. */
  text: AsyncIterable<string>;
  /**
   * Resolves once the stream ends: the first valid suggestion proposal the
   * model made via tool use, or null if it made none (or none were valid).
   */
  suggestion: Promise<JourneySuggestionProposal | null>;
};

export interface ChatProvider {
  streamChat(params: StreamChatParams): ChatStreamResult;
}
