# Project X

## Mission

Project X is an AI-powered psychological support platform.

The goal is not to replace psychologists.

The goal is to help people through difficult moments, reduce anxiety, support progress toward meaningful goals, and become a trusted daily companion.

The AI should feel like an honest, supportive friend.

---

# Current Stage

Current milestone: M4 - Journey MVP

Completed:
- Authentication
- Database setup
- AI Chat (M3)
- Streaming responses
- Conversation persistence

Current work:
Build the Journey system and Dashboard.

---

# Tech Stack

- Next.js
- TypeScript
- TailwindCSS
- Supabase
- Anthropic Claude API

---

# Architecture Principles

Keep everything simple.

Always build MVP first.

Avoid overengineering.

Reuse existing components whenever possible.

Follow the current project structure.

Never duplicate code without a good reason.

Keep components small and readable.

---

# MVP Philosophy

Before adding any feature ask:

Does this help launch the MVP faster?

If not, postpone it.

---

# Journey MVP

For MVP there is only ONE active Journey per user.

Journey contains:

- title
- goal_description
- current_stage
- progress_percentage
- next_step
- status
- created_at
- updated_at

No multiple Journeys.

No analytics.

No achievements.

No AI-generated reports.

No notifications.

Those belong to future versions.

---

# Chat Principles

Chat is the heart of the product.

Never break existing chat functionality.

When modifying chat:

- preserve streaming
- preserve message persistence
- preserve conversation history
- preserve current UI behavior

---

# UI Principles

Minimal.

Calm.

Modern.

No unnecessary animations.

No visual clutter.

Every screen should feel simple and safe.

---

# Code Rules

Before writing code:

1. Understand the existing architecture.
2. Reuse existing files when possible.
3. Explain the implementation plan.
4. Only then implement.

Never rewrite working code without a reason.

Never introduce breaking changes.

Never install unnecessary packages.

---

# Communication

When working:

1. Analyze first.
2. Explain the plan.
3. Mention risks.
4. Wait if a major architectural decision is required.

Prefer small incremental changes.

---

# Coding Style

Write clean TypeScript.

Use meaningful names.

Avoid giant files.

Prefer composition over duplication.

Keep database migrations simple.

Follow Supabase best practices.

---

# Goal

Help build Project X into a production-ready AI product.

Quality is more important than speed.

Simplicity is more important than cleverness.

Always think like a senior software engineer working on a startup MVP.@AGENTS.md
