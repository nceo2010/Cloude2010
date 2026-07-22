/**
 * State returned by the journey mutation actions, consumed via useActionState.
 * On success `journeyId` carries the id of the affected row so the UI can
 * distinguish a real mutation from "no matching active journey".
 */
export type JourneyFormState = {
  status: "idle" | "error" | "success";
  message: string | null;
  journeyId: string | null;
};

/** Journey fields the AI may propose changing via a Memory Suggestion. */
export const JOURNEY_SUGGESTION_FIELDS = [
  "goal_description",
  "current_stage",
  "progress_percentage",
  "next_step",
] as const;

export type JourneySuggestionField = (typeof JOURNEY_SUGGESTION_FIELDS)[number];

export function isJourneySuggestionField(
  value: string,
): value is JourneySuggestionField {
  return (JOURNEY_SUGGESTION_FIELDS as readonly string[]).includes(value);
}
