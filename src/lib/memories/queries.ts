import { createClient } from "@/lib/supabase/server";
import type { Memory } from "@/lib/supabase/types";

const MEMORY_COLUMNS =
  "id, user_id, type, content, origin, source, conversation_id, created_at, updated_at, last_used_at";

/**
 * Returns up to `limit` of the current user's memories, ordered exactly as
 * user_memories_retrieval_idx does: most recently used, then most recently
 * updated, then most recently created.
 *
 * No user session is not an error (returns []) — an unauthenticated caller
 * simply has no memories to show. A DB query failure, however, is NOT
 * swallowed: it's logged and re-thrown. This function only retrieves data;
 * deciding whether a failed lookup should fail the whole request or degrade
 * gracefully (e.g. continue the chat turn without memory context) belongs to
 * the caller, not here — keeps the query layer honest about infrastructure
 * problems instead of silently masking them as "no memories."
 */
export async function getUserMemories(limit: number): Promise<Memory[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_memories")
    .select(MEMORY_COLUMNS)
    .eq("user_id", user.id)
    .order("last_used_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getUserMemories query failed:", error);
    throw new Error("Failed to load your memories.");
  }

  return (data as Memory[] | null) ?? [];
}
