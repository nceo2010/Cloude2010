import { createClient } from "@/lib/supabase/server";
import type { Goal } from "@/lib/supabase/types";

const GOAL_COLUMNS = "id, user_id, title, status, created_at, updated_at";

/**
 * Returns the current user's single active goal, or null when they have none.
 *
 * A database or auth-service error is NOT swallowed into null (that would
 * wrongly render the empty state): the detailed error is logged server-side
 * and a generic error is thrown so the route surfaces its error boundary.
 * Auth is verified via getUser().
 */
export async function getActiveGoal(): Promise<Goal | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.error("getActiveGoal auth check failed:", authError);
    throw new Error("Failed to load your goal.");
  }
  if (!user) return null;

  const { data, error } = await supabase
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getActiveGoal query failed:", error);
    throw new Error("Failed to load your goal.");
  }

  return (data as Goal | null) ?? null;
}
