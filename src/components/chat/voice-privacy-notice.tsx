"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { markPrivacyNoticeSeen } from "@/lib/voice/notice-storage";

type VoicePrivacyNoticeProps = {
  open: boolean;
  onContinue: () => void;
  onCancel: () => void;
};

const TITLE_ID = "voice-privacy-notice-title";
const DESCRIPTION_ID = "voice-privacy-notice-description";

/**
 * One-time confirmation shown before the first voice-input use. Composed
 * from the existing Card/Button primitives — there is no dialog/modal
 * primitive in the project yet, so this intentionally stays a single-purpose
 * overlay rather than introducing a new reusable modal system.
 */
export function VoicePrivacyNotice({
  open,
  onContinue,
  onCancel,
}: VoicePrivacyNoticeProps) {
  const continueButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (open) {
      continueButtonRef.current?.focus();
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  function handleContinue() {
    markPrivacyNoticeSeen();
    onContinue();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <Card
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={DESCRIPTION_ID}
        className="w-full max-w-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader>
          <CardTitle id={TITLE_ID}>Before you use voice input</CardTitle>
          <CardDescription id={DESCRIPTION_ID}>
            Speech recognition is handled by your browser, which may process
            your voice through its own speech service to turn it into text.
            Project X does not intentionally store your microphone audio in
            this version — only the resulting text is used, and only after
            you review and send it yourself.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button ref={continueButtonRef} onClick={handleContinue}>
            Continue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
