import { getActiveJourney } from "@/lib/journeys/queries";
import type { Journey } from "@/lib/supabase/types";

/**
 * Contextual journey retrieval — the seam that becomes the Memory system in M5.
 *
 * M3 deliberately keeps this a lightweight, in-process lexical heuristic:
 * keyword overlap between the user's message and the journey title. No embeddings,
 * no vector store, and NO second LLM call — a classifier round-trip would add
 * latency and cost to every message for a signal this cheap to approximate, and
 * isn't justified at MVP scope. Everything is isolated behind
 * `retrieveRelevantJourney()` so M5 can replace the heuristic (e.g. with
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

/** True when the message shares a content word with the journey title. */
function isRelevant(message: string, journeyTitle: string): boolean {
  const journeyTokens = new Set(tokenize(journeyTitle));
  if (journeyTokens.size === 0) return false;
  return tokenize(message).some((token) => journeyTokens.has(token));
}

/**
 * Returns the active journey relevant to the current message (empty if none).
 * Returns a list so callers don't need to change when M5 surfaces more than
 * one memory/journey, even though M4 yields at most one active journey today.
 */
export async function retrieveRelevantJourney(
  message: string,
): Promise<Journey[]> {
  const journey = await getActiveJourney();
  if (!journey) return [];
  return isRelevant(message, journey.title) ? [journey] : [];
}

/**
 * Formats the relevant journey into a system-prompt block, or an empty string
 * when there is none. Appended after the base personality prompt.
 */
export function formatJourneyContext(journeys: Journey[]): string {
  if (journeys.length === 0) return "";
  const lines = journeys.map((journey) => `- ${journey.title}`).join("\n");
  return `The user has an active journey that appears relevant to their message. Draw on it only if genuinely helpful — do not force it into the conversation:\n${lines}`;
}
