import { createClient } from "@/lib/supabase/server";
import type { Journey } from "@/lib/supabase/types";

const JOURNEY_COLUMNS =
  "id, user_id, title, goal_description, current_stage, progress_percentage, next_step, status, created_at, updated_at";

/**
 * Returns the current user's single active journey, or null when they have none.
 *
 * A database or auth-service error is NOT swallowed into null (that would
 * wrongly render the empty state): the detailed error is logged server-side
 * and a generic error is thrown so the route surfaces its error boundary.
 * Auth is verified via getUser().
 */
export async function getActiveJourney(): Promise<Journey | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.error("getActiveJourney auth check failed:", authError);
    throw new Error("Failed to load your journey.");
  }
  if (!user) return null;

  const { data, error } = await supabase
    .from("journeys")
    .select(JOURNEY_COLUMNS)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getActiveJourney query failed:", error);
    throw new Error("Failed to load your journey.");
  }

  return (data as Journey | null) ?? null;
}

/**
 * Returns how many of the current user's journeys have been marked completed.
 * Used as a lightweight "progress so far" stat — there is no separate steps
 * table in the MVP schema, so a completed Journey is the closest real unit of
 * accomplishment we can count. Returns 0 on any error rather than throwing:
 * this backs a small dashboard stat, not a page's core content.
 */
export async function getCompletedJourneyCount(): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("journeys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "completed");

  if (error) {
    console.error("getCompletedJourneyCount query failed:", error);
    return 0;
  }

  return count ?? 0;
}
