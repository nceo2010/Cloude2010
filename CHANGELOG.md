# Changelog

## v0.5.2-memory — M5.2 Conversation Memory

- Rolling conversation summaries: older messages are folded into a summary instead of falling out of context.
- Added `summary` and `summarized_message_count` fields to `conversations`.
- Unsummarized overflow messages are always included verbatim in context until folded — never dropped.
- Summarization is lazy: triggered on request, once pending overflow reaches the batch threshold.
- Clearing a conversation resets its summary and `summarized_message_count`.
- Verified: TypeScript, lint, migration, and end-to-end tests all passed.
- Commit: `f282484`
- Tag: `v0.5.2-memory`
