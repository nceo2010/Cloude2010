# Project X Roadmap

## Completed

- [x] M1 — Project setup
- [x] M2 — Authentication
- [x] M3 — AI Chat
- [x] Streaming responses
- [x] Conversation persistence
- [x] M4 — Journey MVP
- [x] M5 — Memory system

## Current Milestone

- [ ] M6 — Voice

Goals:
- M6.1 — Voice input
  - Feature detection for `SpeechRecognition` support before showing any voice UI
  - Graceful fallback when unsupported (hide/disable voice input, never a broken control)
  - Handle microphone permission states (prompt, granted, denied)
  - Transcript is editable before sending
  - No automatic send — the user always explicitly submits
  - Privacy notice shown before first use
  - Support both `SpeechRecognition` and `webkitSpeechRecognition` where needed
- M6.2 — Voice output
- M6.3 — Voice preferences (only after M6.1 and M6.2 are tested)
- M6.4 — API-based voice (conditional, deferred until M6.1–M6.3 show real usage)

## Next Milestones

- [ ] M7 — Landing page
- [ ] M8 — Subscription
- [ ] M9 — Deployment

## Deferred Features

These features are not part of the current MVP:

- Multiple Journeys
- Advanced analytics
- Achievements
- AI-generated reports
- Notifications
- Detailed progress history
