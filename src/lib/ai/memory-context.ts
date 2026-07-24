import { getUserMemories } from "@/lib/memories/queries";
import { MEMORY_CONTEXT_LIMIT } from "@/lib/memories/types";
import type { Memory } from "@/lib/supabase/types";

/**
 * Memory context — the read side of Smart Memory, injected into the chat
 * system prompt. Mirrors journey-context.ts's retrieve-then-format shape.
 * Unlike Journey (always at most one), this is a bounded LIST:
 * MEMORY_CONTEXT_LIMIT most recently used/updated/created memories, so the
 * model has enough to target update_memory and avoid proposing duplicates,
 * without unbounded prompt growth as a user's memory count grows over time.
 */

/** Returns the user's memories eligible for chat context, most relevant first. */
export async function retrieveMemoryContext(): Promise<Memory[]> {
  return getUserMemories(MEMORY_CONTEXT_LIMIT);
}

/**
 * Formats retrieved memories into a system-prompt block, or an empty string
 * when the user has none yet. Each memory is shown with its id so the model
 * can target update_memory at an existing one instead of proposing a
 * near-duplicate save_memory — this is the ONLY duplicate-avoidance
 * mechanism in the MVP (no embeddings, no fuzzy matching); it depends on the
 * model reading this list, not on any server-side inference.
 */
export function formatMemoryContext(memories: Memory[]): string {
  if (memories.length === 0) return "";

  const lines = memories.map(
    (memory) => `- [${memory.id}] (${memory.type}) ${memory.content}`,
  );

  return `The user has the following saved memories from past conversations, most relevant first:
${lines.join("\n")}

Treat these as background context, not the default topic — mention them only when genuinely relevant. Before calling save_memory, check whether the idea is already covered by one of these; if so, call update_memory with its id instead of creating a near-duplicate. Only call update_memory with an id shown here — never invent one.`;
}
