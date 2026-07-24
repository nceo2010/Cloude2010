"use client";

import * as React from "react";

import {
  describeConfirmReason,
  INITIAL_MEMORY_STATE,
  MEMORY_CARD_CLASS,
  MEMORY_CARD_DONE_CLASS,
  MEMORY_TYPE_LABELS,
} from "@/components/chat/memory-card-shared";
import { Button } from "@/components/ui/button";
import type { ChatAction } from "@/lib/ai/provider";
import { confirmMemorySave } from "@/lib/memories/actions";

/**
 * A proposed new memory that required confirmation (inferred, sensitive, or
 * a goal/context type — see computeRequiresConfirmation). Accept submits
 * confirmMemorySave, which performs the exact same dedup-aware write an
 * automatic save would have. Dismiss only hides the card locally.
 *
 * `conversationId` is threaded from the chat page so a confirmed save
 * records its originating conversation exactly like an automatic save does —
 * absent/null is submitted as an empty hidden field, which the server action
 * treats as null.
 */
export function MemorySaveConfirmCard({
  action,
  conversationId,
}: {
  action: Extract<ChatAction, { kind: "memory_save_confirm" }>;
  conversationId: string | null;
}) {
  const [state, formAction, pending] = React.useActionState(
    confirmMemorySave,
    INITIAL_MEMORY_STATE,
  );
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  if (state.status === "success") {
    return <div className={MEMORY_CARD_DONE_CLASS}>Memory saved.</div>;
  }

  return (
    <div className={MEMORY_CARD_CLASS}>
      <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        Suggested memory — {MEMORY_TYPE_LABELS[action.type]}
      </div>
      <div className="text-sm">{action.content}</div>
      <div className="text-muted-foreground">
        {describeConfirmReason(action.sensitive, action.origin)}
      </div>
      {state.status === "error" && state.message ? (
        <div className="text-destructive">{state.message}</div>
      ) : null}
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="type" value={action.type} />
        <input type="hidden" name="content" value={action.content} />
        <input type="hidden" name="origin" value={action.origin} />
        <input type="hidden" name="conversationId" value={conversationId ?? ""} />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
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
