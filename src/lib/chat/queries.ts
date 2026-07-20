import { createClient } from "@/lib/supabase/server";
import type { Conversation, Message } from "@/lib/supabase/types";

const CONVERSATION_COLUMNS = "id, user_id, title, created_at, updated_at";
const MESSAGE_COLUMNS = "id, conversation_id, role, content, created_at";

/**
 * Returns the user's current (most recently active) conversation, or null when
 * they have none. Auth is verified via getUser(); a DB or auth-service error is
 * logged and rethrown rather than swallowed into null.
 */
export async function getCurrentConversation(): Promise<Conversation | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.error("getCurrentConversation auth check failed:", authError);
    throw new Error("Failed to load your conversation.");
  }
  if (!user) return null;

  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getCurrentConversation query failed:", error);
    throw new Error("Failed to load your conversation.");
  }

  return (data as Conversation | null) ?? null;
}

/**
 * Returns the messages for a conversation the user owns, in deterministic
 * order (created_at asc, then id asc as a tiebreaker). RLS gates ownership;
 * an unowned or unknown conversation id simply yields an empty list.
 */
export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.error("getMessages auth check failed:", authError);
    throw new Error("Failed to load messages.");
  }
  if (!user) return [];

  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("getMessages query failed:", error);
    throw new Error("Failed to load messages.");
  }

  return (data as Message[] | null) ?? [];
}
