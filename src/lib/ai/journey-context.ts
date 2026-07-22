import { getActiveJourney } from "@/lib/journeys/queries";
import type { Journey } from "@/lib/supabase/types";

/**
 * Journey context — the seam that becomes the Memory system in M5.
 *
 * The user's single active Journey (MVP: at most one) is always included as
 * read-only context when present. No relevance filtering, no embeddings,
 * no second LLM call.
 */

/** Returns the user's active journey, or null when they have none. */
export async function retrieveJourneyContext(): Promise<Journey | null> {
  return getActiveJourney();
}

/**
 * Formats the active journey into a system-prompt block, or an empty string
 * when there is none. Appended after the base personality prompt.
 */
export function formatJourneyContext(journey: Journey | null): string {
  if (!journey) return "";
  const lines = [
    `- Title: ${journey.title}`,
    journey.goal_description ? `- Goal: ${journey.goal_description}` : null,
    journey.current_stage ? `- Current stage: ${journey.current_stage}` : null,
    journey.progress_percentage !== null
      ? `- Progress: ${journey.progress_percentage}%`
      : null,
    journey.next_step ? `- Next step: ${journey.next_step}` : null,
  ].filter((line): line is string => line !== null);

  return `The user has saved the following active Journey as context:
${lines.join("\n")}

Treat this as background context, not the default topic. Do not mention it for greetings, small talk, acknowledgements, or unrelated questions. Mention it only when it genuinely improves the answer, or when the user is discussing goals, progress, motivation, plans, or asks something related — if unsure, prefer not mentioning it. Treat this as user-provided context, not verified fact. Do not invent progress or completed steps beyond what's stated here. You cannot update the database. If a major change to the Journey seems warranted, discuss it with the user and get their agreement before treating it as a new direction.

If the suggest_journey_update tool is available and the user explicitly states a new value for one field (real progress, a new next step, a change of stage or goal), call it immediately in that same reply — do not ask "should I update this?" or otherwise seek confirmation in your reply text first, since the tool call itself is how the user reviews and confirms the change. This is separate from your reply text, so do not also describe the suggestion in your reply. Never call it for greetings or small talk, and never call it more than once per reply.`;
}
