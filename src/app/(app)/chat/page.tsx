import type { Metadata } from "next";

import { ChatWindow } from "@/components/chat/chat-window";
import {
  getConversationById,
  getCurrentConversation,
  getMessages,
} from "@/lib/chat/queries";
import type { ChatMessage } from "@/lib/chat/types";

export const metadata: Metadata = {
  title: "Chat",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ChatPageProps = {
  searchParams: Promise<{ c?: string }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const { c } = await searchParams;
  const requestedId = typeof c === "string" && UUID_RE.test(c) ? c : null;

  // Opening a specific past conversation (e.g. from the dashboard's Recent
  // Conversations list) is opt-in via `?c=`; omitting it keeps the original
  // "most recently active conversation" behavior unchanged. An id that
  // doesn't exist or isn't owned by the user falls back to that same default
  // rather than erroring.
  const conversation = requestedId
    ? ((await getConversationById(requestedId)) ?? (await getCurrentConversation()))
    : await getCurrentConversation();

  const rows = conversation ? await getMessages(conversation.id) : [];

  const initialMessages: ChatMessage[] = rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
  }));

  return (
    <ChatWindow
      conversationId={conversation?.id ?? null}
      initialMessages={initialMessages}
    />
  );
}
