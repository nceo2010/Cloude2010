"use client";

import * as React from "react";

import { SpeakerIcon, StopCircleIcon } from "@/components/chat/icons";
import { MemoryActionCard } from "@/components/chat/memory-action-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SpeechSynthesisState } from "@/hooks/use-speech-synthesis";
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
      <div className="border-border/60 text-muted-foreground mt-2 max-w-[85%] rounded-2xl border px-4 py-3 text-xs sm:max-w-[70%]">
        Journey updated.
      </div>
    );
  }

  return (
    <div className="border-border/60 bg-card mt-2 max-w-[85%] space-y-3 rounded-2xl border px-4 py-3 text-xs sm:max-w-[70%]">
      <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        Suggested Journey update
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground">
          {FIELD_LABELS[suggestion.field]}:{" "}
        </span>
        {formatSuggestionValue(suggestion.field, suggestion.oldValue)}
        <span className="text-muted-foreground"> → </span>
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

type MessageBubbleProps = {
  message: ChatMessage;
  /** True only for the last assistant message while it is still streaming —
   *  its text is a moving target, so the voice control is hidden for it. */
  isStreamingMessage: boolean;
  /** The current conversation's id, threaded down to a memory_save_confirm
   *  card so a confirmed save records its originating conversation, same as
   *  an automatic save already does. */
  conversationId: string | null;
  speechSupported: boolean;
  speechState: SpeechSynthesisState;
  speakingMessageId: string | null;
  speechError: string | null;
  onReadAloud: (messageId: string, text: string) => void;
  onStopSpeaking: () => void;
};

/** A single chat message. Assistant bubbles show "Thinking…" until the first
 *  streamed token arrives. An assistant reply may carry zero or more
 *  structured actions (a Journey update suggestion, and/or Memory save/
 *  update cards), each rendered as its own card below the bubble, and (once
 *  fully streamed) a Read-aloud/Stop voice control. User messages never get
 *  a voice control. */
export function MessageBubble({
  message,
  isStreamingMessage,
  conversationId,
  speechSupported,
  speechState,
  speakingMessageId,
  speechError,
  onReadAloud,
  onStopSpeaking,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const text =
    message.content.length > 0
      ? message.content
      : isUser
        ? ""
        : "Thinking…";

  const isSpeakingThis =
    speakingMessageId === message.id && speechState === "speaking";
  const hasSpeechError =
    speakingMessageId === message.id && speechState === "error";
  const showVoiceControl =
    !isUser &&
    speechSupported &&
    !isStreamingMessage &&
    message.content.trim().length > 0;

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "max-w-[85%] sm:max-w-[75%] bg-primary text-primary-foreground"
            : "border-border/60 bg-card text-card-foreground max-w-[85%] border sm:max-w-[70%]",
        )}
      >
        {text}
      </div>

      {showVoiceControl ? (
        <div className="mt-1">
          {isSpeakingThis ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onStopSpeaking}
              aria-pressed={true}
              aria-label="Stop reading this message aloud"
              className="text-muted-foreground hover:text-foreground h-7 w-7"
            >
              <StopCircleIcon className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onReadAloud(message.id, message.content)}
              aria-pressed={false}
              aria-label="Read this message aloud"
              className="text-muted-foreground hover:text-foreground h-7 w-7"
            >
              <SpeakerIcon className="size-4" />
            </Button>
          )}
        </div>
      ) : null}

      {hasSpeechError && speechError ? (
        <Alert
          variant="destructive"
          className="mt-1 max-w-[85%] sm:max-w-[70%]"
        >
          <AlertDescription>{speechError}</AlertDescription>
        </Alert>
      ) : null}

      {message.actions?.map((action) => {
        if (action.kind === "journey_update") {
          return (
            <JourneySuggestionCard key={`${message.id}-journey_update`} suggestion={action} />
          );
        }
        // memory_save_confirm has no memoryId yet (nothing's been written);
        // every other kind refers to a real row, so its id is a stable key.
        const key =
          action.kind === "memory_save_confirm"
            ? `${message.id}-memory_save_confirm-${action.type}`
            : `${message.id}-${action.kind}-${action.memoryId}`;
        return <MemoryActionCard key={key} action={action} conversationId={conversationId} />;
      })}
    </div>
  );
}
