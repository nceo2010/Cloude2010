/**
 * Feature detection and vendor-prefix resolution for the Web Speech API's
 * SpeechRecognition. TypeScript's bundled DOM lib only ships the result-side
 * types (SpeechRecognitionResult/-Alternative/-ResultList) — the recognizer
 * interface itself, its events, and the Window properties are declared below
 * so no new package is needed.
 */

declare global {
  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  /** Error codes defined by the Web Speech API spec. */
  type SpeechRecognitionErrorCode =
    | "no-speech"
    | "aborted"
    | "audio-capture"
    | "network"
    | "not-allowed"
    | "service-not-allowed"
    | "bad-grammar"
    | "language-not-supported";

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: SpeechRecognitionErrorCode;
    readonly message: string;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
    onerror:
      | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
      | null;
    onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  }

  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

/**
 * Resolves the browser's SpeechRecognition constructor, preferring the
 * standard name over the vendor-prefixed one. Returns null in unsupported
 * browsers or during SSR (no `window`) — callers must feature-detect via
 * this (or `isSpeechRecognitionSupported`) before rendering any voice UI.
 */
export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/** Whether this browser supports the Web Speech API's SpeechRecognition. */
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}
