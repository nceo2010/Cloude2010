"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import type { JourneySuggestion } from "@/lib/ai/provider";
import type { ChatMessage } from "@/lib/chat/types";
import { applyJourneySuggestion } from "@/lib/journeys/actions";
import type { JourneyFormState } from "@/lib/journeys/types";
import { cn } from "@/lib/utils";

const FIELD_LABELS: Record<JourneySuggestion["field"], string> = {
  goal_description: "Goal",
  current_stage: "Current stage",
  progress_percentage: "Progress",
  next_step: "Next step",
};

function formatSuggestionValue(
  field: JourneySuggestion["field"],
  value: string | number | null,
): string {
  if (value === null) return "—";
  return field === "progress_percentage" ? `${value}%` : String(value);
}

const initialSuggestionState: JourneyFormState = {
  status: "idle",
  message: null,
  journeyId: null,
};

/**
 * A suggested Journey field change, shown under the assistant reply that
 * proposed it. Accept submits `applyJourneySuggestion`; Dismiss only hides
 * the card locally — neither ever runs without the user's explicit action.
 */
function JourneySuggestionCard({ suggestion }: { suggestion: JourneySuggestion }) {
  const [state, formAction, pending] = React.useActionState(
    applyJourneySuggestion,
    initialSuggestionState,
  );
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  if (state.status === "success") {
    return (
      <div className="text-muted-foreground mt-2 max-w-[85%] rounded-lg border px-3 py-2 text-xs sm:max-w-[75%]">
        Journey updated.
      </div>
    );
  }

  return (
    <div className="bg-card mt-2 max-w-[85%] space-y-2 rounded-lg border px-3 py-2 text-xs sm:max-w-[75%]">
      <div className="font-medium">Suggested Journey update</div>
      <div className="text-muted-foreground">
        {FIELD_LABELS[suggestion.field]}:{" "}
        {formatSuggestionValue(suggestion.field, suggestion.oldValue)} →{" "}
        {formatSuggestionValue(suggestion.field, suggestion.suggestedValue)}
      </div>
      {state.status === "error" && state.message ? (
        <div className="text-destructive">{state.message}</div>
      ) : null}
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="journeyId" value={suggestion.journeyId} />
        <input type="hidden" name="field" value={suggestion.field} />
        <input
          type="hidden"
          name="oldValue"
          value={JSON.stringify(suggestion.oldValue)}
        />
        <input type="hidden" name="suggestedValue" value={suggestion.suggestedValue} />
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

/** A single chat message. Assistant bubbles show "Thinking…" until the first
 *  streamed token arrives. An assistant reply may carry a Journey Memory
 *  Suggestion, rendered as its own card below the bubble. */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const text =
    message.content.length > 0
      ? message.content
      : isUser
        ? ""
        : "Thinking…";

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap sm:max-w-[75%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground border",
        )}
      >
        {text}
      </div>
      {message.suggestion ? (
        <JourneySuggestionCard suggestion={message.suggestion} />
      ) : null}
    </div>
  );
}
