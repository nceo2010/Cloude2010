-- Milestone M2: goals table — one active goal per user.
-- Apply with the Supabase SQL editor or `supabase db push`.

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null
    check (char_length(trim(title)) between 1 and 200),
  status text not null default 'active'
    check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

-- Enforce a single active goal per user (completed goals are unconstrained).
create unique index if not exists goals_one_active_per_user
  on public.goals (user_id)
  where status = 'active';

-- Helps owner lookups / ordering by recency.
create index if not exists goals_user_id_created_at_idx
  on public.goals (user_id, created_at desc);

-- RLS: a user can only see and mutate their own goals.
drop policy if exists "Goals are viewable by owner" on public.goals;
create policy "Goals are viewable by owner"
  on public.goals for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own goals" on public.goals;
create policy "Users can insert their own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own goals" on public.goals;
create policy "Users can update their own goals"
  on public.goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own goals" on public.goals;
create policy "Users can delete their own goals"
  on public.goals for delete
  using (auth.uid() = user_id);
