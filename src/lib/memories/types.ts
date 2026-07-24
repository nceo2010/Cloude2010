/** Memory categories the AI may propose saving. */
export const MEMORY_TYPES = ["goal", "preference", "context", "communication"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export function isMemoryType(value: string): value is MemoryType {
  return (MEMORY_TYPES as readonly string[]).includes(value);
}

/** Whether the user directly stated a memory, or the model inferred it. */
export const MEMORY_ORIGINS = ["stated", "inferred"] as const;
export type MemoryOrigin = (typeof MEMORY_ORIGINS)[number];

export function isMemoryOrigin(value: string): value is MemoryOrigin {
  return (MEMORY_ORIGINS as readonly string[]).includes(value);
}

/**
 * Enforced consistently in proposal parsing (anthropic.ts), server actions
 * (memories/actions.ts, memories/service.ts), and the `user_memories.content`
 * check constraint (migration 0006) — the same number in all three places.
 */
export const MAX_MEMORY_CONTENT_LENGTH = 300;

/**
 * How many of the user's most-recently-used memories are injected into the
 * chat system prompt, for update-targeting and duplicate avoidance. Bounds
 * prompt size regardless of how many memories a user accumulates over time.
 */
export const MEMORY_CONTEXT_LIMIT = 20;

/**
 * Memory types eligible for automatic saving. Deliberately narrower than "all
 * types" — goal and context memories always require confirmation even when
 * stated and marked safe, per product policy.
 */
const AUTO_SAVE_ELIGIBLE_TYPES: readonly MemoryType[] = ["preference", "communication"];

/**
 * The server-owned confirmation policy. The model's own `sensitive` judgment
 * is one input, never the final word: automatic saving requires ALL of
 * origin === "stated", sensitive === false, AND type being preference or
 * communication. Every inferred memory, every sensitive memory, every goal or
 * context memory, and every memory_update requires explicit confirmation.
 */
export function computeRequiresConfirmation(
  origin: MemoryOrigin,
  sensitive: boolean,
  type: MemoryType,
): boolean {
  const autoEligible =
    origin === "stated" && !sensitive && AUTO_SAVE_ELIGIBLE_TYPES.includes(type);
  return !autoEligible;
}

/**
 * State returned by memory mutation actions, consumed via useActionState.
 * Mirrors JourneyFormState in shape and purpose.
 */
export type MemoryFormState = {
  status: "idle" | "error" | "success";
  message: string | null;
  memoryId: string | null;
};
