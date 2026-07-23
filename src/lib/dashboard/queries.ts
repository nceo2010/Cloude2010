import { createClient } from "@/lib/supabase/server";

/**
 * Cross-domain reads that exist only to back small dashboard widgets (stat
 * cards, insight copy) — never used by the Chat or Journey features
 * themselves, so they can stay best-effort (return a safe default on error)
 * without risking the page's core content.
 */

const STREAK_LOOKBACK_MESSAGES = 500;

/**
 * Returns the user's current daily activity streak: the number of
 * consecutive calendar days (ending today or yesterday) with at least one
 * chat message. Derived entirely from existing message timestamps — no new
 * table, no schema change.
 *
 * Bounded to the most recent STREAK_LOOKBACK_MESSAGES messages, which makes
 * this a heuristic rather than an exact all-time count (an extremely
 * high-volume conversation could in theory undercount a streak older than
 * that window). Day grouping uses UTC calendar days as a simple
 * approximation rather than the user's local timezone.
 */
export async function getActivityStreak(): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase
    .from("messages")
    .select("created_at, conversations!inner(user_id)")
    .eq("conversations.user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(STREAK_LOOKBACK_MESSAGES);

  if (error) {
    console.error("getActivityStreak query failed:", error);
    return 0;
  }

  const rows = (data as { created_at: string }[] | null) ?? [];
  if (rows.length === 0) return 0;

  const activeDays = new Set(
    rows.map((row) => row.created_at.slice(0, 10)),
  );

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  let cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  // A streak still counts if today has no activity yet but yesterday does —
  // the user's day isn't over. Forgive a single missing "today" before
  // requiring unbroken days going backward.
  if (!activeDays.has(cursor.toISOString().slice(0, 10))) {
    cursor = new Date(cursor.getTime() - ONE_DAY_MS);
  }

  let streak = 0;
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!activeDays.has(key)) break;
    streak += 1;
    cursor = new Date(cursor.getTime() - ONE_DAY_MS);
  }

  return streak;
}
