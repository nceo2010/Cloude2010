import type { MemoryFormState, MemoryOrigin, MemoryType } from "@/lib/memories/types";

/** Initial useActionState value shared by all three Memory cards. */
export const INITIAL_MEMORY_STATE: MemoryFormState = {
  status: "idle",
  message: null,
  memoryId: null,
};

/** Shared visual language across the three Memory cards — kept in lockstep with JourneySuggestionCard's classes. */
export const MEMORY_CARD_CLASS =
  "border-border/60 bg-card mt-2 max-w-[85%] space-y-3 rounded-2xl border px-4 py-3 text-xs sm:max-w-[70%]";
export const MEMORY_CARD_DONE_CLASS =
  "border-border/60 text-muted-foreground mt-2 max-w-[85%] rounded-2xl border px-4 py-3 text-xs sm:max-w-[70%]";

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  goal: "Goal",
  preference: "Preference",
  context: "Context",
  communication: "Communication",
};

/** Why this particular save needed the user's explicit confirmation. */
export function describeConfirmReason(sensitive: boolean, origin: MemoryOrigin): string {
  if (sensitive) return "This may be sensitive — confirm to save it.";
  if (origin === "inferred") return "The assistant inferred this — confirm to save it.";
  return "Confirm to save this memory.";
}
