-- Milestone M5: Smart Memory — user_memories table.
-- Apply with the Supabase SQL editor or `supabase db push`.

-- Postgres has no `CREATE TYPE IF NOT EXISTS`, so guard each enum manually to
-- keep this migration safe to re-run.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'memory_type') then
    create type public.memory_type as enum ('goal', 'preference', 'context', 'communication');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'memory_origin') then
    create type public.memory_origin as enum ('stated', 'inferred');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'memory_source') then
    create type public.memory_source as enum ('chat', 'manual');
  end if;
end
$$;

create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.memory_type not null,
  content text not null
    check (char_length(btrim(content)) between 1 and 300),
  origin public.memory_origin not null,
  source public.memory_source not null default 'chat',
  conversation_id uuid
    references public.conversations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

alter table public.user_memories enable row level security;

-- Context-injection retrieval order: most recently used, then most recently
-- updated, then most recently created — matches the ORDER BY used in
-- retrieveMemoryContext. created_at is the final, always-distinct tie-breaker
-- (last_used_at and updated_at can tie for rows that were never re-touched).
create index if not exists user_memories_retrieval_idx
  on public.user_memories (user_id, last_used_at desc, updated_at desc, created_at desc);

-- Exact-duplicate prevention: trimmed + case-insensitive equality within the
-- same user and type. Internal whitespace is NOT collapsed — "a  b" and "a b"
-- are treated as distinct. This is the final guard against a race between two
-- concurrent requests; application code checks for duplicates first and
-- falls back to catching a violation of this index (23505).
create unique index if not exists user_memories_unique_content_idx
  on public.user_memories (user_id, type, lower(btrim(content)));

-- Keep updated_at authoritative at the DB level, same principle as
-- touch_conversation_updated_at in 0003_chat.sql: application code should
-- never need to set it manually, so it can't be forgotten on any write path
-- (automatic save, confirmed save, or update).
create or replace function public.touch_user_memories_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_memories_touch_updated_at on public.user_memories;
create trigger user_memories_touch_updated_at
  before update on public.user_memories
  for each row
  execute function public.touch_user_memories_updated_at();

-- RLS: a user can only see and mutate their own memories.
drop policy if exists "Memories are viewable by owner" on public.user_memories;
create policy "Memories are viewable by owner"
  on public.user_memories for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own memories" on public.user_memories;
create policy "Users can insert their own memories"
  on public.user_memories for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own memories" on public.user_memories;
create policy "Users can update their own memories"
  on public.user_memories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own memories" on public.user_memories;
create policy "Users can delete their own memories"
  on public.user_memories for delete
  using (auth.uid() = user_id);
