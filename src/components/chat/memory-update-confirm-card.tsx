"use client";

import * as React from "react";

import {
  INITIAL_MEMORY_STATE,
  MEMORY_CARD_CLASS,
  MEMORY_CARD_DONE_CLASS,
  MEMORY_TYPE_LABELS,
} from "@/components/chat/memory-card-shared";
import { Button } from "@/components/ui/button";
import type { ChatAction } from "@/lib/ai/provider";
import { confirmMemoryUpdate } from "@/lib/memories/actions";

/**
 * A proposed change to an existing memory's content. Always requires
 * confirmation (memory_update is never automatic). Accept submits
 * confirmMemoryUpdate, which applies only if the memory's content still
 * matches `oldContent` — the same optimistic-concurrency pattern as the
 * Journey suggestion card.
 */
export function MemoryUpdateConfirmCard({
  action,
}: {
  action: Extract<ChatAction, { kind: "memory_update_confirm" }>;
}) {
  const [state, formAction, pending] = React.useActionState(
    confirmMemoryUpdate,
    INITIAL_MEMORY_STATE,
  );
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  if (state.status === "success") {
    return <div className={MEMORY_CARD_DONE_CLASS}>Memory updated.</div>;
  }

  return (
    <div className={MEMORY_CARD_CLASS}>
      <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        Suggested memory update — {MEMORY_TYPE_LABELS[action.type]}
      </div>
      <div className="text-sm">
        {action.oldContent}
        <span className="text-muted-foreground"> → </span>
        {action.newContent}
      </div>
      {state.status === "error" && state.message ? (
        <div className="text-destructive">{state.message}</div>
      ) : null}
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="memoryId" value={action.memoryId} />
        <input type="hidden" name="oldContent" value={action.oldContent} />
        <input type="hidden" name="newContent" value={action.newContent} />
        <input type="hidden" name="origin" value={action.origin} />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Accept"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </Button>
      </form>
    </div>
  );
}
