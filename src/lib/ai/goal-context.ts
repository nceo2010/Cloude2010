import { getActiveGoal } from "@/lib/goals/queries";
import type { Goal } from "@/lib/supabase/types";

/**
 * Contextual goal retrieval — the seam that becomes the Memory system in M5.
 *
 * M3 deliberately keeps this a lightweight, in-process lexical heuristic:
 * keyword overlap between the user's message and the goal title. No embeddings,
 * no vector store, and NO second LLM call — a classifier round-trip would add
 * latency and cost to every message for a signal this cheap to approximate, and
 * isn't justified at MVP scope. Everything is isolated behind
 * `retrieveRelevantGoals()` so M5 can replace the heuristic (e.g. with
 * embeddings / semantic memory) without changing any caller.
 */

const STOP_WORDS = new Set([
  "the", "and", "for", "you", "your", "are", "was", "were", "but", "not",
  "with", "this", "that", "what", "why", "how", "who", "when", "where",
  "have", "has", "had", "can", "will", "would", "could", "should", "about",
  "into", "from", "they", "them", "some", "any", "help", "want", "need",
  "get", "got", "just", "like", "really", "very", "much", "more",
]);

/** Lowercase, split on non-alphanumerics, drop short words and stop words. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

/** True when the message shares a content word with the goal title. */
function isRelevant(message: string, goalTitle: string): boolean {
  const goalTokens = new Set(tokenize(goalTitle));
  if (goalTokens.size === 0) return false;
  return tokenize(message).some((token) => goalTokens.has(token));
}

/**
 * Returns the active goals relevant to the current message (empty if none).
 * Returns a list so callers don't need to change when M5 surfaces more than
 * one memory/goal, even though M2 yields at most one active goal today.
 */
export async function retrieveRelevantGoals(message: string): Promise<Goal[]> {
  const goal = await getActiveGoal();
  if (!goal) return [];
  return isRelevant(message, goal.title) ? [goal] : [];
}

/**
 * Formats relevant goals into a system-prompt block, or an empty string when
 * there are none. Appended after the base personality prompt.
 */
export function formatGoalContext(goals: Goal[]): string {
  if (goals.length === 0) return "";
  const lines = goals.map((goal) => `- ${goal.title}`).join("\n");
  return `The user has these active goals that appear relevant to their message. Draw on them only if genuinely helpful — do not force them into the conversation:\n${lines}`;
}
