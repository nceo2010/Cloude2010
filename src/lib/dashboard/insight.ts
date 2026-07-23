import type { Journey } from "@/lib/supabase/types";

const NO_JOURNEY_INSIGHT =
  "Set your first Journey and this space will start reflecting your progress.";

/**
 * A short, personalized check-in message for the dashboard's "Today's Focus"
 * card — meant to read like a quick note from a coach, not a data readout.
 *
 * Deliberately NOT a model call: this stays a deterministic read of the
 * Journey's own fields (progress, stage, next step) plus the activity
 * streak, so the dashboard doesn't introduce any new AI API call. It's a
 * placeholder for a real AI-generated insight — swapping it for one later
 * means replacing this function's body with a call through the existing
 * ChatProvider, without touching the component that renders it.
 */
export function buildJourneyInsight(
  journey: Journey | null,
  streak: number,
): string {
  if (!journey) return NO_JOURNEY_INSIGHT;

  const progress = journey.progress_percentage;

  if (streak >= 3) {
    return journey.next_step
      ? `You've shown up ${streak} days in a row — that consistency matters. Today, that means: ${journey.next_step}.`
      : `You've shown up ${streak} days in a row. That kind of consistency is what actually moves things forward.`;
  }

  if (journey.next_step) {
    return `The next concrete step is "${journey.next_step}". A few focused minutes on it is enough for today.`;
  }

  if (progress !== null && progress >= 80) {
    return `You're ${progress}% of the way through "${journey.title}" — close enough to start deciding what "done" looks like.`;
  }

  if (progress !== null && progress > 0) {
    return `You're ${progress}% into "${journey.title}". What's the smallest next step you could take today?`;
  }

  if (journey.current_stage) {
    return `You're at "${journey.current_stage}" on "${journey.title}". A quick check-in in chat can help shape what's next.`;
  }

  return `You've set "${journey.title}" as your Journey. Talk it through in chat to land on a concrete next step.`;
}

/**
 * A short, calm line of context for the Hero — meant to make the section
 * feel personal rather than a data readout. Intentionally plain: no
 * exclamation points, no motivational-poster tone.
 */
export function buildHeroContextLine(journey: Journey): string {
  const progress = journey.progress_percentage;

  if (progress !== null && progress >= 80) {
    return "You're closing in on this one.";
  }
  if (progress !== null && progress >= 40) {
    return "You're making steady progress.";
  }
  if (progress !== null && progress > 0) {
    return "Keep moving one step at a time.";
  }
  if (journey.next_step) {
    return "Today's small step moves you closer.";
  }
  return "Keep moving one step at a time.";
}
