import type { JourneySuggestionField } from "@/lib/journeys/types";
import type { MemoryOrigin, MemoryType } from "@/lib/memories/types";

/**
 * Provider-agnostic chat interface. The rest of the app depends only on these
 * types — never on a specific SDK — so the AI provider can be swapped by adding
 * a new implementation (see `anthropic.ts`) without touching callers.
 *
 * Two distinct vocabularies live in this file, deliberately not merged:
 *  - `ActionProposal` — what the model asks for via tool use. Untrusted,
 *    unvalidated against the database, never applied automatically.
 *  - `ChatAction` — what the server sends to the client after enriching (or,
 *    for an already-committed automatic save, after applying) a proposal.
 *    Only `ChatAction` values are safe to show the user.
 */

/** A single turn in the model conversation. */
export type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

// ---------------------------------------------------------------------------
// Journey
// ---------------------------------------------------------------------------

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
  kind: "journey_update";
  journeyId: string;
  oldValue: string | number | null;
};

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

/**
 * A new memory proposed by the model via a tool call — untrusted. `sensitive`
 * is the model's own judgment call; the server computes the actual
 * confirmation policy from `origin` + `sensitive` + `type`, never trusting
 * this proposal's classification directly (see memories/service.ts).
 */
export type MemorySaveProposal = {
  type: MemoryType;
  content: string;
  origin: MemoryOrigin;
  sensitive: boolean;
};

/**
 * A change to an existing memory's content proposed by the model. `memoryId`
 * is a reference, not an authority — the caller must verify it belongs to the
 * requesting user and fetch the current content fresh (never trust the
 * model's implicit idea of what the old value was).
 */
export type MemoryUpdateProposal = {
  memoryId: string;
  newContent: string;
  origin: MemoryOrigin;
  sensitive: boolean;
};

/**
 * A memory save already committed automatically (safe + stated), sent to the
 * client as a fait accompli so it can offer View/Undo. Not a proposal — the
 * row already exists.
 */
export type MemorySavedAction = {
  kind: "memory_saved";
  memoryId: string;
  type: MemoryType;
  content: string;
};

/** A proposed new memory that requires explicit user confirmation before it's written. */
export type MemorySaveConfirmAction = {
  kind: "memory_save_confirm";
  type: MemoryType;
  content: string;
  origin: MemoryOrigin;
  sensitive: boolean;
};

/**
 * A proposed change to an existing memory, enriched with the current content
 * read fresh from the database (never the model's guess of it). Always
 * requires confirmation — memory_update is never automatic.
 */
export type MemoryUpdateConfirmAction = {
  kind: "memory_update_confirm";
  memoryId: string;
  type: MemoryType;
  oldContent: string;
  newContent: string;
  origin: MemoryOrigin;
};

// ---------------------------------------------------------------------------
// Action proposals — model output, untrusted (streamChat's `actions` result)
// ---------------------------------------------------------------------------

export type ActionProposal =
  | ({ kind: "journey_update" } & JourneySuggestionProposal)
  | ({ kind: "memory_save" } & MemorySaveProposal)
  | ({ kind: "memory_update" } & MemoryUpdateProposal);

// ---------------------------------------------------------------------------
// Chat actions — server-verified, safe to send to the client
// ---------------------------------------------------------------------------

export type ChatAction =
  | JourneySuggestion
  | MemorySavedAction
  | MemorySaveConfirmAction
  | MemoryUpdateConfirmAction;

export type StreamChatParams = {
  /** System prompt (personality + any injected context). */
  system: string;
  /** Conversation turns, oldest first, already trimmed to the context window. */
  messages: AiMessage[];
  /** Optional abort signal so the caller can cancel an in-flight stream. */
  signal?: AbortSignal;
  /**
   * Offer the model a tool to propose one Journey-field update. Pass true
   * only when the user has an active Journey to propose changes to. Memory
   * tools (save/update) are always offered — they have no such precondition.
   */
  allowJourneySuggestion?: boolean;
};

export type ChatStreamResult = {
  /** The assistant's reply as incremental text chunks — unchanged from before. */
  text: AsyncIterable<string>;
  /**
   * Resolves once the stream ends: every valid action proposal the model made
   * via tool use, in the order those tool calls completed. The provider caps
   * how many of each kind it captures per turn (see anthropic.ts) — this is
   * never unbounded.
   */
  actions: Promise<ActionProposal[]>;
};

export type SummarizeParams = {
  /** The prior rolling summary, or null if this conversation has none yet. */
  priorSummary: string | null;
  /**
   * The batch of older messages to fold into the summary, oldest first.
   * Untrusted conversation content — the summarizer must treat it as data to
   * describe, never as instructions to follow.
   */
  messages: AiMessage[];
};

export interface ChatProvider {
  streamChat(params: StreamChatParams): ChatStreamResult;
  /** Folds a batch of older messages into an updated rolling summary. */
  summarize(params: SummarizeParams): Promise<string>;
}
