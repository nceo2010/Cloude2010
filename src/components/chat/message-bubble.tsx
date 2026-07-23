"use client";

import * as React from "react";

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

type MessageBubbleProps = {
  message: ChatMessage;
  /** True only for the last assistant message while it is still streaming —
   *  its text is a moving target, so the voice control is hidden for it. */
  isStreamingMessage: boolean;
  speechSupported: boolean;
  speechState: SpeechSynthesisState;
  speakingMessageId: string | null;
  speechError: string | null;
  onReadAloud: (messageId: string, text: string) => void;
  onStopSpeaking: () => void;
};

/** A single chat message. Assistant bubbles show "Thinking…" until the first
 *  streamed token arrives. An assistant reply may carry a Journey Memory
 *  Suggestion, rendered as its own card below the bubble, and (once fully
 *  streamed) a Read-aloud/Stop voice control. User messages never get a
 *  voice control. */
export function MessageBubble({
  message,
  isStreamingMessage,
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
          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap sm:max-w-[75%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground border",
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
              size="sm"
              onClick={onStopSpeaking}
              aria-pressed={true}
              aria-label="Stop reading this message aloud"
            >
              Stop
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onReadAloud(message.id, message.content)}
              aria-pressed={false}
              aria-label="Read this message aloud"
            >
              Read aloud
            </Button>
          )}
        </div>
      ) : null}

      {hasSpeechError && speechError ? (
        <Alert
          variant="destructive"
          className="mt-1 max-w-[85%] sm:max-w-[75%]"
        >
          <AlertDescription>{speechError}</AlertDescription>
        </Alert>
      ) : null}

      {message.suggestion ? (
        <JourneySuggestionCard suggestion={message.suggestion} />
      ) : null}
    </div>
  );
}
