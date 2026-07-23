/**
 * Feature detection and lightweight text-cleaning for the Web Speech API's
 * SpeechSynthesis (text-to-speech). Unlike SpeechRecognition, both
 * `SpeechSynthesis` and `SpeechSynthesisUtterance` are already fully typed
 * in TypeScript's bundled DOM lib, so no ambient declarations are needed.
 */

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

/** Returns the browser's SpeechSynthesis singleton, or null when unsupported
 *  or during SSR (no `window`). */
export function getSpeechSynthesis(): SpeechSynthesis | null {
  if (!isSpeechSynthesisSupported()) return null;
  return window.speechSynthesis;
}

const CODE_BLOCK_PLACEHOLDER = "Code block omitted.";

/** Fenced ```code``` blocks are replaced with a short spoken cue rather than
 *  read character-by-character. Must run before other passes, since their
 *  contents shouldn't be treated as prose. */
function stripFencedCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, CODE_BLOCK_PLACEHOLDER);
}

/** Inline `code` spans are unwrapped to their plain text — short snippets
 *  like `npm install` read fine as plain words. */
function unwrapInlineCode(text: string): string {
  return text.replace(/`([^`]+)`/g, "$1");
}

/** Leading #/##/### markers on heading lines. */
function stripHeaders(text: string): string {
  return text.replace(/^#{1,6}[ \t]+/gm, "");
}

/**
 * Bold/italic markers (double or triple asterisks, double or single
 * underscores) are unwrapped to plain text. Note: single-underscore/asterisk
 * emphasis can misfire on things like snake_case_words (e.g. turning
 * "snake_case_word" into "snakecase_word") — an accepted MVP limitation for
 * a regex-only, no-dependency approach.
 */
function stripEmphasis(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/___(.+?)___/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1");
}

/** [label](url) links are read as just the label — never the URL. */
function unwrapLinks(text: string): string {
  return text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
}

/** Leading -/*\/+ or "1." list markers at the start of a line. */
function stripListMarkers(text: string): string {
  return text
    .replace(/^[ \t]*[-*+][ \t]+/gm, "")
    .replace(/^[ \t]*\d+\.[ \t]+/gm, "");
}

/** Leading > blockquote markers at the start of a line. */
function stripBlockquoteMarkers(text: string): string {
  return text.replace(/^>[ \t]?/gm, "");
}

/** Collapses runs of spaces/tabs and blank lines left behind by the passes
 *  above, so speech doesn't stumble over leftover gaps. */
function collapseWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function cleanPass(raw: string): string {
  let text = raw;
  text = stripFencedCodeBlocks(text);
  text = stripHeaders(text);
  text = stripEmphasis(text);
  text = unwrapLinks(text);
  text = stripListMarkers(text);
  text = stripBlockquoteMarkers(text);
  text = unwrapInlineCode(text);
  text = collapseWhitespace(text);
  return text;
}

// The loop below is convergence-driven — it exits as soon as a pass makes no
// further change, which is what actually guarantees idempotency, not this
// number. There's no tight mathematical bound on how many passes realistic
// (or adversarial) markdown could need, so this is a generous backstop
// against pathological input looping indefinitely, not a claimed sufficient
// count — ordinary messages converge in a single pass in practice.
const MAX_CLEAN_PASSES = 10;

/**
 * Produces a version of `raw` suitable for speech: markdown syntax stripped,
 * code blocks replaced with a short spoken cue, nothing truncated. Never
 * mutates or affects the displayed message text — callers pass this only to
 * the speech utterance.
 *
 * Idempotent by construction: iterates `cleanPass` to a fixed point (a
 * single pass already resolves the vast majority of real markdown, since
 * each regex's global match already handles chains like "*a*a*a*" in one
 * scan, but nested constructs can need more than one pass to fully settle).
 * Once a call reaches a fixed point, re-running cleanTextForSpeech on that
 * output is guaranteed to return it unchanged on the very first pass.
 */
export function cleanTextForSpeech(raw: string): string {
  let text = raw;
  for (let i = 0; i < MAX_CLEAN_PASSES; i += 1) {
    const next = cleanPass(text);
    if (next === text) break;
    text = next;
  }
  return text;
}
