import type { Metadata } from "next";

import { ChatWindow } from "@/components/chat/chat-window";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentConversation, getMessages } from "@/lib/chat/queries";
import type { ChatMessage } from "@/lib/chat/types";

export const metadata: Metadata = {
  title: "Chat",
};

export default async function ChatPage() {
  const conversation = await getCurrentConversation();
  const rows = conversation ? await getMessages(conversation.id) : [];

  const initialMessages: ChatMessage[] = rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat"
        description="Talk through your progress with the assistant."
      />
      <ChatWindow
        conversationId={conversation?.id ?? null}
        initialMessages={initialMessages}
      />
    </div>
  );
}
