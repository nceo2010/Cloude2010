import type { ChatRole } from "@/lib/supabase/types";

/** Maximum length of a single user message, enforced in the app/route layer. */
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * How many of the most recent messages to include as model context.
 * M3 uses a simple recency window — no summarization (that belongs to M5).
 */
export const CONTEXT_WINDOW_SIZE = 20;

/** Title used for a fresh or cleared conversation. */
export const DEFAULT_CONVERSATION_TITLE = "New conversation";

/**
 * A message as rendered by the chat UI. Persisted messages carry their DB id;
 * an in-flight streaming assistant message uses a temporary client id until it
 * is saved and the conversation reloads.
 */
export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};
