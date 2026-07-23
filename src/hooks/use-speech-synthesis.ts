"use client";

import * as React from "react";

import {
  cleanTextForSpeech,
  getSpeechSynthesis,
  isSpeechSynthesisSupported,
} from "@/lib/voice/speech-synthesis";

/**
 * M6.2 state machine — deliberately simpler than M6.1's: there is no
 * permission step, and pause/resume is out of scope for this milestone (see
 * design notes), so "paused" is not part of the state union.
 *
 *   idle --speak()--> speaking --onend----> idle
 *                         |
 *                      onerror
 *                         v
 *                       error  (non-terminal, settles back to idle)
 *
 * stop() (or a speak() call for a different message) forces speaking -> idle
 * directly, regardless of end/error.
 */
export type SpeechSynthesisState = "unsupported" | "idle" | "speaking" | "error";

export type UseSpeechSynthesisResult = {
  state: SpeechSynthesisState;
  /** Which message is currently speaking, or null. */
  speakingMessageId: string | null;
  error: string | null;
  isSupported: boolean;
  /** Speaks `text` for `messageId`. No-ops if unsupported, if the cleaned
   *  text is empty, or if this exact message is already speaking. Cancels
   *  any other message's speech first. */
  speak: (messageId: string, text: string) => void;
  stop: () => void;
};

type OperationalState = Exclude<SpeechSynthesisState, "unsupported">;

// Hydration-safe feature detection, same pattern as useSpeechRecognition:
// server snapshot is always false, client snapshot reads the real
// capability, no subscription needed since support can't change mid-session.
function subscribeToSpeechSynthesisSupport(): () => void {
  return () => {};
}

function getSpeechSynthesisSupportSnapshot(): boolean {
  return isSpeechSynthesisSupported();
}

function getSpeechSynthesisSupportServerSnapshot(): boolean {
  return false;
}

// speechSynthesis.cancel() followed immediately by speak() in the same tick
// is unreliable (most consistently reported on Chrome): the new utterance
// can be silently dropped because cancel()'s teardown is asynchronous even
// though the call returns synchronously. Deferring the follow-up speak() by
// a real macrotask (not just a microtask) is the commonly used workaround.
const CANCEL_TO_SPEAK_DELAY_MS = 50;

const GENERIC_ERROR = "Couldn't read this message aloud.";

// How long the errored message stays highlighted (inline Alert + non-idle
// state) before auto-settling back to idle — long enough to actually notice,
// short enough to stay non-terminal and out of the way.
const ERROR_DISPLAY_MS = 1500;

/**
 * Wraps the Web Speech API's SpeechSynthesis behind a small state machine.
 * A single instance is meant to be shared for an entire chat (owns which
 * message, if any, is currently speaking) rather than one per message —
 * `speechSynthesis` itself is a page-global singleton, so per-message
 * instances would fight each other.
 */
export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const isSupported = React.useSyncExternalStore(
    subscribeToSpeechSynthesisSupport,
    getSpeechSynthesisSupportSnapshot,
    getSpeechSynthesisSupportServerSnapshot,
  );
  const [internalState, setInternalState] = React.useState<OperationalState>("idle");
  const [speakingMessageId, setSpeakingMessageId] = React.useState<string | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const state: SpeechSynthesisState = isSupported ? internalState : "unsupported";

  // Bumped on every new intent (a speak() request or a stop()) so async
  // callbacks — the cancel-to-speak delay timer, and an utterance's own
  // end/error handlers — can tell whether they're still the thing the hook
  // currently wants, or a stale leftover from a superseded/cancelled one.
  const sessionTokenRef = React.useRef(0);
  const pendingSpeakTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const settleTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearPendingSpeakTimer = React.useCallback(() => {
    if (pendingSpeakTimeoutRef.current !== null) {
      clearTimeout(pendingSpeakTimeoutRef.current);
      pendingSpeakTimeoutRef.current = null;
    }
  }, []);

  const clearSettleTimeout = React.useCallback(() => {
    if (settleTimeoutRef.current !== null) {
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
  }, []);

  /**
   * Non-terminal error state settles back to idle on its own after
   * ERROR_DISPLAY_MS — long enough for the inline Alert to actually be
   * noticed, not just flash. Deliberately clears speakingMessageId only
   * here (not in the error handler itself) so it stays attached to the
   * message that errored for that whole window — callers attribute an
   * inline error to a specific message via
   * `speakingMessageId === message.id && state === "error"`.
   */
  const settleToIdle = React.useCallback(() => {
    clearSettleTimeout();
    settleTimeoutRef.current = setTimeout(() => {
      setInternalState("idle");
      setSpeakingMessageId(null);
    }, ERROR_DISPLAY_MS);
  }, [clearSettleTimeout]);

  const stop = React.useCallback(() => {
    // Invalidate any pending delayed speak and any in-flight utterance's
    // handlers before touching the browser API, so their eventual
    // end/error — cancel() itself can trigger either, browser-dependent —
    // is recognized as stale and ignored rather than re-processed.
    sessionTokenRef.current += 1;
    clearPendingSpeakTimer();
    clearSettleTimeout();
    getSpeechSynthesis()?.cancel();
    setInternalState("idle");
    setSpeakingMessageId(null);
  }, [clearPendingSpeakTimer, clearSettleTimeout]);

  const speak = React.useCallback(
    (messageId: string, text: string) => {
      if (!isSupported) return;
      const cleaned = cleanTextForSpeech(text);
      if (cleaned.length === 0) return; // nothing usable — no utterance created

      // Rapid-click guard: this exact message is already speaking.
      if (internalState === "speaking" && speakingMessageId === messageId) {
        return;
      }

      const synth = getSpeechSynthesis();
      if (!synth) return;

      sessionTokenRef.current += 1;
      const myToken = sessionTokenRef.current;
      clearPendingSpeakTimer();
      clearSettleTimeout();
      setError(null);

      const doSpeak = () => {
        if (sessionTokenRef.current !== myToken) return; // superseded/cancelled

        const utterance = new SpeechSynthesisUtterance(cleaned);

        utterance.addEventListener("end", () => {
          if (sessionTokenRef.current !== myToken) return; // stale session
          setInternalState("idle");
          setSpeakingMessageId(null);
        });

        utterance.addEventListener("error", () => {
          if (sessionTokenRef.current !== myToken) return; // stale session
          setError(GENERIC_ERROR);
          setInternalState("error");
          // speakingMessageId stays set to this message until settleToIdle
          // clears it, so the error can be attributed to the right bubble.
          settleToIdle();
        });

        setInternalState("speaking");
        setSpeakingMessageId(messageId);
        synth.speak(utterance);
      };

      if (internalState === "speaking") {
        // Switching messages: cancel the current one, reflect that
        // immediately (nothing is speaking right now), then defer the new
        // speak() past the cancel — see CANCEL_TO_SPEAK_DELAY_MS above.
        synth.cancel();
        setInternalState("idle");
        setSpeakingMessageId(null);
        pendingSpeakTimeoutRef.current = setTimeout(() => {
          pendingSpeakTimeoutRef.current = null;
          doSpeak();
        }, CANCEL_TO_SPEAK_DELAY_MS);
      } else {
        doSpeak();
      }
    },
    [
      isSupported,
      internalState,
      speakingMessageId,
      clearPendingSpeakTimer,
      clearSettleTimeout,
      settleToIdle,
    ],
  );

  React.useEffect(() => {
    return () => {
      sessionTokenRef.current += 1;
      clearPendingSpeakTimer();
      clearSettleTimeout();
      getSpeechSynthesis()?.cancel();
    };
  }, [clearPendingSpeakTimer, clearSettleTimeout]);

  return { state, speakingMessageId, error, isSupported, speak, stop };
}
