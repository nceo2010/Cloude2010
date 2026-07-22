"use client";

import * as React from "react";

import { getSpeechRecognitionConstructor } from "@/lib/voice/speech-recognition";

/**
 * M6.1 state machine:
 *
 *   idle -> requesting-permission -> listening -> processing -> idle
 *                    |                   |  \
 *                 denied               error  cancel -> idle (discards transcript)
 *                    v                   v
 *                  idle                idle
 *
 * denied/error are transient: they surface a message via `error`, then the
 * hook settles back to idle on its own so the caller can always retry —
 * there is no permanently "disabled" state.
 */
export type SpeechRecognitionState =
  | "unsupported"
  | "idle"
  | "requesting-permission"
  | "listening"
  | "processing"
  | "denied"
  | "error";

export type UseSpeechRecognitionResult = {
  state: SpeechRecognitionState;
  transcript: string;
  error: string | null;
  isSupported: boolean;
  start: () => void;
  /**
   * Requests the session finalize and resolves with the transcript accepted
   * for that session (final + trailing interim text), or "" if the session
   * ends with nothing usable, fails, or is cancelled before it settles.
   * Never rejects; always settles exactly once.
   */
  stop: () => Promise<string>;
  cancel: () => void;
  resetTranscript: () => void;
};

/** The state machine's internal states — everything except "unsupported",
 *  which is derived from `isSupported` rather than tracked as a real state. */
type OperationalState = Exclude<SpeechRecognitionState, "unsupported">;

// Stable (module-level) subscribe function for useSyncExternalStore: browser
// API support can't change during a page session, so there's nothing to
// subscribe to — this is a permanent no-op that never calls onStoreChange.
function subscribeToSpeechSupport(): () => void {
  return () => {};
}

function getSpeechSupportSnapshot(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

function getSpeechSupportServerSnapshot(): boolean {
  return false;
}

/** How long to wait for "end"/"error" after stop() before forcing settlement. */
const STOP_WATCHDOG_MS = 5000;

const ERROR_MESSAGES: Record<SpeechRecognitionErrorCode, string> = {
  "no-speech": "No speech was detected. Try again.",
  aborted: "Voice input was cancelled.",
  "audio-capture": "No microphone was found.",
  network: "A network error interrupted voice input.",
  "not-allowed": "Microphone access was denied.",
  "service-not-allowed": "Microphone access was denied.",
  "bad-grammar": "Voice input could not be understood.",
  "language-not-supported": "This language isn't supported for voice input.",
};

function messageForError(code: SpeechRecognitionErrorCode): string {
  return ERROR_MESSAGES[code] ?? "Voice input failed.";
}

function isDenialError(code: SpeechRecognitionErrorCode): boolean {
  return code === "not-allowed" || code === "service-not-allowed";
}

/**
 * Wraps the Web Speech API's SpeechRecognition behind the M6.1 state
 * machine. Never touches chat/input UI state directly — callers read
 * `transcript` and decide how and when to merge it into their own input.
 */
export function useSpeechRecognition(): UseSpeechRecognitionResult {
  // Hydration-safe browser feature detection: server snapshot is always
  // false, client snapshot reads the real capability. No subscription is
  // needed since support can't change mid-session (see subscribeToSpeechSupport).
  const isSupported = React.useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupportSnapshot,
    getSpeechSupportServerSnapshot,
  );
  const [internalState, setInternalState] = React.useState<OperationalState>("idle");
  const state: SpeechRecognitionState = isSupported ? internalState : "unsupported";
  const [transcript, setTranscript] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // The active recognition instance doubles as an identity token: every
  // handler closes over the instance it was registered on and checks it
  // against this ref, so events from a superseded/cancelled/unmounted
  // session (a "stale" session) are ignored instead of corrupting state.
  const recognitionRef = React.useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = React.useRef("");
  // Mirrors exactly what's exposed as `transcript` (final + trailing
  // interim), read synchronously by event handlers so stop()'s promise
  // always settles with the truly latest value, independent of whether
  // React has flushed the corresponding state update yet.
  const currentTranscriptRef = React.useRef("");
  const settleTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // The resolver for an in-flight stop() promise, if any. Cleared the
  // instant it's used, so settling is idempotent even if multiple code
  // paths (end, error, cancel, the watchdog) all attempt it for the same
  // session.
  const stopResolverRef = React.useRef<((transcript: string) => void) | null>(
    null,
  );
  // Watchdog for an in-flight stop(): forces settlement if neither "end" nor
  // "error" arrives in time. Always created/cleared alongside stopResolverRef.
  const stopWatchdogRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearSettleTimeout = React.useCallback(() => {
    if (settleTimeoutRef.current !== null) {
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
  }, []);

  const clearStopWatchdog = React.useCallback(() => {
    if (stopWatchdogRef.current !== null) {
      clearTimeout(stopWatchdogRef.current);
      stopWatchdogRef.current = null;
    }
  }, []);

  /**
   * Resolves any in-flight stop() promise exactly once; a no-op otherwise.
   * Always clears the watchdog too, so every settlement path — end, error,
   * cancel, a fresh start(), unmount, or the watchdog itself — cancels it.
   */
  const settleStop = React.useCallback(
    (transcriptValue: string) => {
      clearStopWatchdog();
      const resolve = stopResolverRef.current;
      stopResolverRef.current = null;
      resolve?.(transcriptValue);
    },
    [clearStopWatchdog],
  );

  /** Non-terminal denied/error states settle back to idle on their own. */
  const settleToIdle = React.useCallback(() => {
    clearSettleTimeout();
    settleTimeoutRef.current = setTimeout(() => setInternalState("idle"), 0);
  }, [clearSettleTimeout]);

  const stop = React.useCallback((): Promise<string> => {
    const instance = recognitionRef.current;
    if (!instance) return Promise.resolve("");
    // Only one stop() should be in flight per session — a second call while
    // one is already pending doesn't re-invoke the browser API or replace
    // the first caller's promise, it just settles empty for the caller.
    if (stopResolverRef.current) return Promise.resolve("");

    // stop() lets the service finalize whatever was captured so far — the
    // current transcript is accepted, not discarded.
    setInternalState((prev) => (prev === "listening" ? "processing" : prev));
    const promise = new Promise<string>((resolve) => {
      stopResolverRef.current = resolve;
    });
    // Watchdog: if neither "end" nor "error" arrives, force settlement so
    // the promise can never hang forever.
    stopWatchdogRef.current = setTimeout(() => {
      stopWatchdogRef.current = null;
      if (recognitionRef.current === instance) {
        recognitionRef.current = null;
        setInternalState((prev) =>
          prev === "listening" || prev === "processing" ? "idle" : prev,
        );
        instance.abort();
      }
      settleStop(currentTranscriptRef.current);
    }, STOP_WATCHDOG_MS);
    instance.stop();
    return promise;
  }, [settleStop]);

  const cancel = React.useCallback(() => {
    const instance = recognitionRef.current;
    if (!instance) return;
    // Detach identity first so any event abort() triggers (sync or async)
    // is already stale by the time it's handled.
    recognitionRef.current = null;
    clearSettleTimeout();
    finalTranscriptRef.current = "";
    currentTranscriptRef.current = "";
    setTranscript("");
    setInternalState("idle");
    settleStop("");
    instance.abort();
  }, [clearSettleTimeout, settleStop]);

  const resetTranscript = React.useCallback(() => {
    finalTranscriptRef.current = "";
    currentTranscriptRef.current = "";
    setTranscript("");
  }, []);

  const start = React.useCallback(() => {
    if (
      !isSupported ||
      internalState === "listening" ||
      internalState === "requesting-permission" ||
      internalState === "processing"
    ) {
      return;
    }
    const Constructor = getSpeechRecognitionConstructor();
    if (!Constructor) return;

    clearSettleTimeout();
    // Defensive: a new session invalidates any promise from a prior one.
    settleStop("");

    // Defensive: discard any leftover instance before starting a new one.
    if (recognitionRef.current) {
      const stale = recognitionRef.current;
      recognitionRef.current = null;
      stale.abort();
    }

    const instance = new Constructor();
    instance.continuous = false;
    instance.interimResults = true;

    finalTranscriptRef.current = "";
    currentTranscriptRef.current = "";
    setTranscript("");
    setError(null);
    setInternalState("requesting-permission");

    instance.addEventListener("start", () => {
      if (recognitionRef.current !== instance) return; // stale session
      setInternalState("listening");
    });

    instance.addEventListener("result", (rawEvent) => {
      if (recognitionRef.current !== instance) return; // stale session
      const event = rawEvent as SpeechRecognitionEvent;
      setInternalState("listening");
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalTranscriptRef.current += text;
        } else {
          interim += text;
        }
      }
      const combined = finalTranscriptRef.current + interim;
      currentTranscriptRef.current = combined;
      setTranscript(combined);
    });

    instance.addEventListener("error", (rawEvent) => {
      if (recognitionRef.current !== instance) return; // stale session
      const event = rawEvent as SpeechRecognitionErrorEvent;
      recognitionRef.current = null;
      setError(messageForError(event.error));
      setInternalState(isDenialError(event.error) ? "denied" : "error");
      settleToIdle();
      // A failure after stop() was called must not leave it pending.
      settleStop("");
    });

    instance.addEventListener("end", () => {
      if (recognitionRef.current !== instance) return; // stale session
      recognitionRef.current = null;
      setInternalState((prev) =>
        prev === "listening" || prev === "processing" ? "idle" : prev,
      );
      settleStop(currentTranscriptRef.current);
    });

    recognitionRef.current = instance;
    try {
      instance.start();
    } catch {
      recognitionRef.current = null;
      setError("Voice input could not be started.");
      setInternalState("error");
      settleToIdle();
      settleStop("");
    }
  }, [isSupported, internalState, clearSettleTimeout, settleToIdle, settleStop]);

  React.useEffect(() => {
    return () => {
      clearSettleTimeout();
      const instance = recognitionRef.current;
      recognitionRef.current = null;
      // abort()'s resulting events (if any) will be stale-guarded away by the
      // recognitionRef reset above, so settle explicitly here too — otherwise
      // an in-flight stop() promise would hang forever past unmount.
      settleStop("");
      instance?.abort();
    };
  }, [clearSettleTimeout, settleStop]);

  return { state, transcript, error, isSupported, start, stop, cancel, resetTranscript };
}
