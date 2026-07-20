-- Milestone M3: chat — conversations and messages.
-- Apply with the Supabase SQL editor or `supabase db push`.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation'
    check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 100000),
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Owner lookups / recency ordering.
create index if not exists conversations_user_id_updated_at_idx
  on public.conversations (user_id, updated_at desc);

-- Supports deterministic message ordering: order by created_at asc, id asc.
create index if not exists messages_conversation_created_id_idx
  on public.messages (conversation_id, created_at, id);

-- Keep conversations.updated_at authoritative at the DB level: any message
-- insert or delete touches the parent conversation, so recency ordering and
-- "clear conversation" stay correct even if application code forgets.
create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'DELETE') then
    update public.conversations
      set updated_at = now()
      where id = old.conversation_id;
    return old;
  end if;
  update public.conversations
    set updated_at = now()
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert or delete on public.messages
  for each row
  execute function public.touch_conversation_updated_at();

-- RLS: conversations — owner only.
drop policy if exists "Conversations are viewable by owner" on public.conversations;
create policy "Conversations are viewable by owner"
  on public.conversations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own conversations" on public.conversations;
create policy "Users can insert their own conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own conversations" on public.conversations;
create policy "Users can update their own conversations"
  on public.conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own conversations" on public.conversations;
create policy "Users can delete their own conversations"
  on public.conversations for delete
  using (auth.uid() = user_id);

-- RLS: messages — access gated through the owning conversation.
drop policy if exists "Messages are viewable by conversation owner" on public.messages;
create policy "Messages are viewable by conversation owner"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert messages into their conversations" on public.messages;
create policy "Users can insert messages into their conversations"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete messages in their conversations" on public.messages;
create policy "Users can delete messages in their conversations"
  on public.messages for delete
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );
