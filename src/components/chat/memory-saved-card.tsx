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
import { deleteMemory } from "@/lib/memories/actions";

/**
 * A memory the server already saved automatically (safe + explicitly
 * stated). Shown as a compact toast with View/Undo — Undo just deletes the
 * row, the same operation available for any memory, not a separate mechanism.
 */
export function MemorySavedCard({
  action,
}: {
  action: Extract<ChatAction, { kind: "memory_saved" }>;
}) {
  const [state, formAction, pending] = React.useActionState(
    deleteMemory,
    INITIAL_MEMORY_STATE,
  );
  const [expanded, setExpanded] = React.useState(false);

  if (state.status === "success") {
    return <div className={MEMORY_CARD_DONE_CLASS}>Memory removed.</div>;
  }

  return (
    <div className={MEMORY_CARD_CLASS}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">
          ✓ Memory saved{" "}
          <span className="text-muted-foreground/70">
            ({MEMORY_TYPE_LABELS[action.type]})
          </span>
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Hide" : "View"}
          </Button>
          <form action={formAction}>
            <input type="hidden" name="memoryId" value={action.memoryId} />
            <Button type="submit" variant="ghost" size="sm" disabled={pending}>
              {pending ? "Undoing…" : "Undo"}
            </Button>
          </form>
        </div>
      </div>
      {expanded ? <div className="text-sm">{action.content}</div> : null}
      {state.status === "error" && state.message ? (
        <div className="text-destructive">{state.message}</div>
      ) : null}
    </div>
  );
}
