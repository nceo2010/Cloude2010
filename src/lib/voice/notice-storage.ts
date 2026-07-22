/**
 * Persistence for the voice-input privacy notice's dismissal state. A thin
 * abstraction over localStorage (rather than calling it directly from UI
 * code) so the backing store can change later without touching components.
 *
 * Safe during SSR (no `window`/`localStorage`) and safe if storage access
 * throws (private browsing, disabled storage, quota errors) — a failure here
 * just means the notice shows again next time, never a thrown error in the UI.
 */

const PRIVACY_NOTICE_KEY = "voice-input-privacy-notice-seen";

/** Whether the user has already dismissed the voice-input privacy notice. */
export function hasSeenPrivacyNotice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PRIVACY_NOTICE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Records that the user has dismissed the voice-input privacy notice. */
export function markPrivacyNoticeSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRIVACY_NOTICE_KEY, "1");
  } catch {
    // Storage unavailable (private browsing, quota, disabled) — the notice
    // will simply show again next time. Never surfaced to the UI.
  }
}
