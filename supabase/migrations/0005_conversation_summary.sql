-- Milestone M5.2: conversation memory — rolling summary of overflow messages.
-- Apply with the Supabase SQL editor or `supabase db push`.

alter table public.conversations
  add column if not exists summary text
    check (char_length(summary) <= 4000),
  add column if not exists summarized_message_count integer
    not null default 0
    check (summarized_message_count >= 0);
