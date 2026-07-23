import Link from "next/link";

import { ChatBubbleIcon } from "@/components/dashboard/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { routes } from "@/lib/routes";
import type { Conversation } from "@/lib/supabase/types";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < MINUTE_MS) return "just now";
  if (diffMs < HOUR_MS) return `${Math.round(diffMs / MINUTE_MS)}m ago`;
  if (diffMs < DAY_MS) return `${Math.round(diffMs / HOUR_MS)}h ago`;
  if (diffMs < 7 * DAY_MS) return `${Math.round(diffMs / DAY_MS)}d ago`;
  return new Date(iso).toLocaleDateString();
}

type RecentConversationsProps = {
  conversations: Conversation[];
};

/** A lightweight list of recent conversations. Each opens straight into Chat. */
export function RecentConversations({ conversations }: RecentConversationsProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        Recent conversations
      </h2>

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Start talking with the assistant to build your history here."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`${routes.chat}?c=${conversation.id}`}
              className="border-border/60 bg-card hover:border-border hover:bg-accent/40 flex items-start gap-3 rounded-2xl border p-5 shadow-sm transition-colors dark:shadow-none"
            >
              <ChatBubbleIcon className="text-muted-foreground/60 mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium">
                  {conversation.title}
                </p>
                <p className="text-muted-foreground/70 text-xs">
                  {relativeTime(conversation.updated_at)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
