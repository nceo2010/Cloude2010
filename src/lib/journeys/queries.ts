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
