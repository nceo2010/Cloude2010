-- Milestone M4: rename goals -> journeys, add Journey MVP fields.
-- Apply with the Supabase SQL editor or `supabase db push`.

alter table public.goals rename to journeys;

alter table public.journeys
  add column if not exists goal_description text,
  add column if not exists current_stage text,
  add column if not exists progress_percentage integer
    check (progress_percentage between 0 and 100),
  add column if not exists next_step text;

alter index if exists goals_one_active_per_user
  rename to journeys_one_active_per_user;
alter index if exists goals_user_id_created_at_idx
  rename to journeys_user_id_created_at_idx;

alter policy "Goals are viewable by owner" on public.journeys
  rename to "Journeys are viewable by owner";
alter policy "Users can insert their own goals" on public.journeys
  rename to "Users can insert their own journeys";
alter policy "Users can update their own goals" on public.journeys
  rename to "Users can update their own journeys";
alter policy "Users can delete their own goals" on public.journeys
  rename to "Users can delete their own journeys";
