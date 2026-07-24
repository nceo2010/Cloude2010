import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_MEMORY_CONTENT_LENGTH, type MemoryOrigin, type MemoryType } from "@/lib/memories/types";
import type { Memory } from "@/lib/supabase/types";

/**
 * Memory write logic shared by the automatic-save path (chat route) and the
 * confirmed-save path (memories/actions.ts). Deliberately a plain module, not
 * "use server" — it's called from server-side code that already holds an
 * authenticated Supabase client for the current request, mirroring
 * chat/summary.ts's relationship to chat/actions.ts. Kept separate from
 * Journey's write logic entirely; the two share no code.
 */

const MEMORY_COLUMNS =
  "id, user_id, type, content, origin, source, conversation_id, created_at, updated_at, last_used_at";

const UNIQUE_VIOLATION = "23505";

/**
 * A Memory service failure. Every throw in this module uses this type
 * instead of a bare `Error`, so a caller (route.ts, memories/actions.ts) can
 * recognize "the service itself failed for a known reason" via `instanceof`
 * if it ever needs to, rather than every throw site inventing its own ad hoc
 * Error. Carries the underlying Supabase error (when there is one) as
 * `cause`, so the original failure is still inspectable from the thrown
 * error alone without needing a return value to smuggle it through.
 */
export class MemoryServiceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "MemoryServiceError";
  }
}

/**
 * Escapes ILIKE pattern characters (%, _, \) so a plain string is matched
 * literally rather than as a wildcard pattern.
 */
function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

/**
 * Finds an existing memory for this user + type whose content matches
 * `trimmedContent` case-insensitively — the same "exact duplicate" definition
 * user_memories_unique_content_idx enforces at the DB level (trimmed,
 * case-folded equality; internal whitespace is NOT collapsed).
 *
 * `null` here is a normal, expected outcome ("no duplicate exists"). A query
 * failure is a different thing entirely and must NOT be treated the same way
 * — silently returning null on error would make createMemory proceed to
 * insert as if no duplicate existed, which is exactly the bug this function
 * exists to prevent. So a query error throws instead.
 */
async function findDuplicateMemory(
  supabase: SupabaseClient,
  userId: string,
  type: MemoryType,
  trimmedContent: string,
): Promise<Memory | null> {
  const { data, error } = await supabase
    .from("user_memories")
    .select(MEMORY_COLUMNS)
    .eq("user_id", userId)
    .eq("type", type)
    .ilike("content", escapeIlikePattern(trimmedContent))
    .maybeSingle();

  if (error) {
    console.error("findDuplicateMemory query failed:", error);
    throw new MemoryServiceError("Failed to check for a duplicate memory.", { cause: error });
  }
  return (data as Memory | null) ?? null;
}

/**
 * Bumps last_used_at on an existing memory — a duplicate save "used" it
 * again. Unlike findDuplicateMemory, there is no legitimate "not found" case
 * here: the caller always passes an id it just read moments earlier in the
 * same request, so a missing row or query error is unexpected and throws.
 */
async function touchMemory(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<Memory> {
  const { data, error } = await supabase
    .from("user_memories")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select(MEMORY_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("touchMemory update failed:", error);
    throw new MemoryServiceError("Failed to update an existing memory.", { cause: error });
  }
  if (!data) {
    throw new MemoryServiceError("touchMemory: no matching row (deleted concurrently?).");
  }
  return data as Memory;
}

export type CreateMemoryParams = {
  type: MemoryType;
  content: string;
  origin: MemoryOrigin;
  /** The conversation this memory originated from, or null. */
  conversationId: string | null;
};

/**
 * Creates a memory, or — if an exact duplicate already exists for this user
 * and type — returns the existing row with `last_used_at` bumped instead of
 * inserting a new one. Used identically by the automatic-save path and the
 * confirmed-save path; the only difference between them is who decided the
 * write should happen, never the write itself.
 *
 * Always resolves to a real `Memory` row or throws — there is no null
 * "failure" return here. Every failure mode (content that somehow still
 * fails validation after trimming despite callers already checking it, an
 * unexpected insert error, or the near-impossible "unique violation but the
 * winning row vanished" race) is a genuinely exceptional condition, not a
 * normal outcome a caller should have to null-check for — so each one throws
 * with a descriptive message and lets the caller's own try/catch decide the
 * user-facing consequence (skip this one action, or show a generic error).
 *
 * `content` is trimmed and re-validated against MAX_MEMORY_CONTENT_LENGTH
 * here too, even though callers should already have validated it — this is
 * the last point before a DB write, so it doesn't trust upstream validation
 * alone. `source` is always "chat" and `updated_at` is never set manually —
 * the DB trigger owns it.
 */
export async function createMemory(
  supabase: SupabaseClient,
  userId: string,
  params: CreateMemoryParams,
): Promise<Memory> {
  const trimmed = params.content.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_MEMORY_CONTENT_LENGTH) {
    // Callers validate before calling; reaching here means a caller broke
    // that contract — fail loudly rather than silently returning null.
    throw new MemoryServiceError("createMemory: content failed validation after trim");
  }

  // Pre-check first (the common, non-racing case) — cheaper than an insert
  // that's expected to fail, and avoids an error-code round trip most of the
  // time. The unique index is still the source of truth: if a concurrent
  // request wins the race between this check and the insert below, the
  // insert fails with 23505 and we fall back to the same lookup.
  const existing = await findDuplicateMemory(supabase, userId, params.type, trimmed);
  if (existing) {
    return touchMemory(supabase, existing.id, userId);
  }

  const { data, error } = await supabase
    .from("user_memories")
    .insert({
      user_id: userId,
      type: params.type,
      content: trimmed,
      origin: params.origin,
      source: "chat",
      conversation_id: params.conversationId,
    })
    .select(MEMORY_COLUMNS)
    .single();

  if (!error) {
    return data as Memory;
  }

  if (error.code === UNIQUE_VIOLATION) {
    // Lost the race: someone else's identical insert committed between our
    // pre-check and this insert. Their row is the real one — fetch and touch it.
    const winner = await findDuplicateMemory(supabase, userId, params.type, trimmed);
    if (winner) {
      return touchMemory(supabase, winner.id, userId);
    }
    // Vanishingly unlikely (e.g. the winning row was deleted in between).
    throw new MemoryServiceError("createMemory: unique violation but no matching row found");
  }

  console.error("createMemory insert failed:", error);
  throw new MemoryServiceError("Failed to save the memory.", { cause: error });
}

/**
 * Fetches a single memory by id, scoped to its owner — used to enrich a
 * memory_update proposal with the current authoritative content before
 * asking the user to confirm (never trust the model's implicit idea of the
 * current value).
 *
 * Unlike createMemory, `null` here has exactly one meaning a caller needs to
 * act on regardless of cause: "don't surface this proposal." A stale or
 * model-invented id and a query failure both lead to the same response
 * (drop the action), so both return null rather than throwing — a query
 * error is still logged, just not escalated, since escalating it wouldn't
 * change what the caller does with it.
 */
export async function getMemoryForUpdate(
  supabase: SupabaseClient,
  userId: string,
  memoryId: string,
): Promise<Pick<Memory, "id" | "type" | "content"> | null> {
  const { data, error } = await supabase
    .from("user_memories")
    .select("id, type, content")
    .eq("id", memoryId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("getMemoryForUpdate query failed:", error);
    return null;
  }
  return (data as Pick<Memory, "id" | "type" | "content"> | null) ?? null;
}
