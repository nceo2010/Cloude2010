"use client";

import * as React from "react";

import { VoicePrivacyNotice } from "@/components/chat/voice-privacy-notice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { hasSeenPrivacyNotice } from "@/lib/voice/notice-storage";

type ChatInputProps = {
  disabled: boolean;
  onSend: (text: string) => void;
};

/**
 * Appends `addition` onto `base` with a single separating space (trimming
 * any trailing whitespace `base` already has), or returns `addition` alone
 * when `base` is empty. Only ever called with a non-empty `addition`.
 */
function appendWithSpacing(base: string, addition: string): string {
  const trimmedBase = base.replace(/\s+$/, "");
  return trimmedBase.length > 0 ? `${trimmedBase} ${addition}` : addition;
}

/** Message composer. Enter sends; Shift+Enter inserts a newline. */
export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = React.useState("");

  const {
    state: voiceState,
    error: voiceError,
    isSupported: voiceSupported,
    start: startVoice,
    stop: stopVoice,
    cancel: cancelVoice,
    resetTranscript,
  } = useSpeechRecognition();

  const [showPrivacyNotice, setShowPrivacyNotice] = React.useState(false);
  const [isStopping, setIsStopping] = React.useState(false);
  const micButtonRef = React.useRef<HTMLButtonElement>(null);

  const isVoiceSessionActive =
    voiceState === "requesting-permission" ||
    voiceState === "listening" ||
    voiceState === "processing";

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function handleMicClick() {
    if (disabled) return;
    if (!hasSeenPrivacyNotice()) {
      setShowPrivacyNotice(true);
      return;
    }
    startVoice();
  }

  function handleNoticeContinue() {
    setShowPrivacyNotice(false);
    startVoice();
    micButtonRef.current?.focus();
  }

  function handleNoticeCancel() {
    setShowPrivacyNotice(false);
    micButtonRef.current?.focus();
  }

  async function handleStopClick() {
    if (disabled || isStopping) return;
    setIsStopping(true);
    try {
      const finalTranscript = await stopVoice();
      const trimmed = finalTranscript.trim();
      if (trimmed.length > 0) {
        setValue((prev) => appendWithSpacing(prev, trimmed));
      }
    } finally {
      resetTranscript();
      setIsStopping(false);
    }
  }

  function handleCancelClick() {
    if (disabled) return;
    // cancelVoice() resolves any in-flight stop() promise with "" itself, so
    // a pending handleStopClick() (isStopping) unwinds safely and merges
    // nothing — value is never touched here.
    cancelVoice();
  }

  return (
    <div className="border-t p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled}
          aria-label="Message"
          placeholder="Send a message…  (Enter to send, Shift+Enter for a new line)"
          className={cn(
            "border-input bg-background max-h-40 flex-1 resize-none rounded-md border px-3 py-2 text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />

        {voiceSupported ? (
          isVoiceSessionActive ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleStopClick}
                disabled={disabled || isStopping}
                aria-label="Stop voice input and use the transcript"
              >
                {isStopping ? "Stopping…" : "Stop"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelClick}
                disabled={disabled}
                aria-label="Cancel voice input"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              ref={micButtonRef}
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMicClick}
              disabled={disabled}
              aria-label="Start voice input"
            >
              Voice
            </Button>
          )
        ) : null}

        <Button
          type="button"
          onClick={submit}
          disabled={disabled || value.trim().length === 0}
        >
          Send
        </Button>
      </div>

      {voiceError ? (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{voiceError}</AlertDescription>
        </Alert>
      ) : null}

      <VoicePrivacyNotice
        open={showPrivacyNotice}
        onContinue={handleNoticeContinue}
        onCancel={handleNoticeCancel}
      />
    </div>
  );
}
