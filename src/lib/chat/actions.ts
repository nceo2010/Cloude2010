"use server";

import { revalidatePath } from "next/cache";

import { DEFAULT_CONVERSATION_TITLE } from "@/lib/chat/types";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create a new empty conversation. Because the chat page resolves "current" as
 * the most recently updated conversation, the freshly inserted row (its
 * updated_at defaults to now()) becomes current on the next render.
 */
export async function createConversation(): Promise<string | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("createConversation auth check failed:", authError);
    return null;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: user.id, title: DEFAULT_CONVERSATION_TITLE })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createConversation insert failed:", error);
    return null;
  }

  revalidatePath(routes.chat);
  return data.id as string;
}

/**
 * Clear a conversation: delete all of its messages and reset the title, but
 * keep the conversation record itself. Scoped by owner; RLS also gates the
 * message delete through the owning conversation.
 */
export async function clearConversation(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("clearConversation auth check failed:", authError);
    return;
  }

  const raw = formData.get("conversationId");
  if (typeof raw !== "string" || !UUID_RE.test(raw)) {
    return;
  }

  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", raw);
  if (deleteError) {
    console.error("clearConversation delete failed:", deleteError);
    return;
  }

  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      title: DEFAULT_CONVERSATION_TITLE,
      updated_at: new Date().toISOString(),
    })
    .eq("id", raw)
    .eq("user_id", user.id);
  if (updateError) {
    console.error("clearConversation update failed:", updateError);
    return;
  }

  revalidatePath(routes.chat);
}
