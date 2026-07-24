"use server";

import { createMemory } from "@/lib/memories/service";
import {
  isMemoryOrigin,
  isMemoryType,
  MAX_MEMORY_CONTENT_LENGTH,
  type MemoryFormState,
  type MemoryOrigin,
  type MemoryType,
} from "@/lib/memories/types";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong. Please try again.";

const notSignedIn: MemoryFormState = {
  status: "error",
  message: "You must be signed in.",
  memoryId: null,
};

/** Log the real error server-side; return a generic message to the UI. */
function fail(context: string, error: unknown): MemoryFormState {
  console.error(`${context}:`, error);
  return { status: "error", message: GENERIC_ERROR, memoryId: null };
}

/** Validate a memoryId from the form as a UUID, or return an error state. */
function parseMemoryId(formData: FormData): { id: string } | MemoryFormState {
  const raw = formData.get("memoryId");
  if (typeof raw !== "string" || !UUID_RE.test(raw)) {
    return { status: "error", message: "Invalid memory reference.", memoryId: null };
  }
  return { id: raw };
}

/** Validate a memory type from the form against the fixed allowlist. */
function parseMemoryType(formData: FormData): { type: MemoryType } | MemoryFormState {
  const raw = formData.get("type");
  if (typeof raw !== "string" || !isMemoryType(raw)) {
    return { status: "error", message: "Invalid memory type.", memoryId: null };
  }
  return { type: raw };
}

/** Validate a memory origin from the form against the fixed allowlist. */
function parseMemoryOrigin(formData: FormData): { origin: MemoryOrigin } | MemoryFormState {
  const raw = formData.get("origin");
  if (typeof raw !== "string" || !isMemoryOrigin(raw)) {
    return { status: "error", message: "Invalid memory origin.", memoryId: null };
  }
  return { origin: raw };
}

/** Validate + trim a memory content field, or return an error state. */
function parseMemoryContent(
  formData: FormData,
  field: string,
): { content: string } | MemoryFormState {
  const raw = formData.get(field);
  if (typeof raw !== "string") {
    return { status: "error", message: "Invalid memory content.", memoryId: null };
  }
  const content = raw.trim();
  if (content.length === 0 || content.length > MAX_MEMORY_CONTENT_LENGTH) {
    return {
      status: "error",
      message: `Memory content must be ${MAX_MEMORY_CONTENT_LENGTH} characters or fewer.`,
      memoryId: null,
    };
  }
  return { content };
}

/** Optional conversationId the memory originated from — absent/blank means null. */
function parseOptionalConversationId(
  formData: FormData,
): { conversationId: string | null } | MemoryFormState {
  const raw = formData.get("conversationId");
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { conversationId: null };
  }
  if (!UUID_RE.test(raw)) {
    return { status: "error", message: "Invalid conversation reference.", memoryId: null };
  }
  return { conversationId: raw };
}

/**
 * Save a memory the user explicitly confirmed — a memory_save_confirm card
 * shown because the proposal was inferred, sensitive, or a goal/context type
 * (see computeRequiresConfirmation). Reuses the exact same dedup-aware
 * insert as an automatic save (memories/service.ts's createMemory); the only
 * difference between the two paths is who triggered the write.
 */
export async function confirmMemorySave(
  _prevState: MemoryFormState,
  formData: FormData,
): Promise<MemoryFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return fail("confirmMemorySave auth check failed", authError);
  if (!user) return notSignedIn;

  const typeParsed = parseMemoryType(formData);
  if ("status" in typeParsed) return typeParsed;

  const contentParsed = parseMemoryContent(formData, "content");
  if ("status" in contentParsed) return contentParsed;

  const originParsed = parseMemoryOrigin(formData);
  if ("status" in originParsed) return originParsed;

  const conversationParsed = parseOptionalConversationId(formData);
  if ("status" in conversationParsed) return conversationParsed;

  // createMemory throws rather than returning null on failure.
  try {
    const memory = await createMemory(supabase, user.id, {
      type: typeParsed.type,
      content: contentParsed.content,
      origin: originParsed.origin,
      conversationId: conversationParsed.conversationId,
    });
    return { status: "success", message: null, memoryId: memory.id };
  } catch (error) {
    return fail("confirmMemorySave: createMemory failed", error);
  }
}

/**
 * Apply a confirmed memory_update. Applies ONLY when the live content still
 * matches the snapshotted `oldContent` the suggestion was made against —
 * checked atomically in the update's WHERE clause, the same optimistic
 * concurrency pattern as applyJourneySuggestion. `type` is never part of the
 * update payload, so it cannot change via this action regardless of what a
 * client submits.
 */
export async function confirmMemoryUpdate(
  _prevState: MemoryFormState,
  formData: FormData,
): Promise<MemoryFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return fail("confirmMemoryUpdate auth check failed", authError);
  if (!user) return notSignedIn;

  const idParsed = parseMemoryId(formData);
  if ("status" in idParsed) return idParsed;

  const oldContentParsed = parseMemoryContent(formData, "oldContent");
  if ("status" in oldContentParsed) return oldContentParsed;

  const newContentParsed = parseMemoryContent(formData, "newContent");
  if ("status" in newContentParsed) return newContentParsed;

  const originParsed = parseMemoryOrigin(formData);
  if ("status" in originParsed) return originParsed;

  const { data, error } = await supabase
    .from("user_memories")
    .update({
      content: newContentParsed.content,
      origin: originParsed.origin,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", idParsed.id)
    .eq("user_id", user.id)
    .eq("content", oldContentParsed.content)
    .select("id")
    .maybeSingle();

  if (error) return fail("confirmMemoryUpdate failed", error);
  if (!data) {
    return {
      status: "error",
      message:
        "This memory has changed since the suggestion was made — please review its current value.",
      memoryId: null,
    };
  }

  return { status: "success", message: null, memoryId: data.id };
}

/**
 * Delete a memory, scoped to its owner. Used both for general memory
 * management and for Undo right after an automatic save — Undo IS deleting,
 * not a separate mechanism, per the accepted Memory Action Contract.
 */
export async function deleteMemory(
  _prevState: MemoryFormState,
  formData: FormData,
): Promise<MemoryFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return fail("deleteMemory auth check failed", authError);
  if (!user) return notSignedIn;

  const idParsed = parseMemoryId(formData);
  if ("status" in idParsed) return idParsed;

  const { data, error } = await supabase
    .from("user_memories")
    .delete()
    .eq("id", idParsed.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return fail("deleteMemory failed", error);
  if (!data) {
    return { status: "error", message: "No matching memory to delete.", memoryId: null };
  }

  return { status: "success", message: null, memoryId: data.id };
}
