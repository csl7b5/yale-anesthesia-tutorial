-- 007: Fix RLS circular dependency
-- The instructor policies query `profiles` to check role,
-- but `profiles` itself has RLS, creating a 500 error loop.
-- Fix: use a SECURITY DEFINER function that bypasses RLS.

-- Helper function: returns the current user's role without going through RLS
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ── Drop ALL existing policies and recreate cleanly ──────────────────────

-- Profiles
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Instructors can read all profiles" on public.profiles;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Instructors can read all profiles"
  on public.profiles for select
  using (current_user_role() in ('instructor', 'admin'));

-- Scenario attempts
drop policy if exists "Users can insert own attempts" on public.scenario_attempts;
drop policy if exists "Users can read own attempts" on public.scenario_attempts;
drop policy if exists "Users can update own attempts" on public.scenario_attempts;
drop policy if exists "Instructors can read all attempts" on public.scenario_attempts;

create policy "Users can insert own attempts"
  on public.scenario_attempts for insert
  with check (user_id = auth.uid());

create policy "Users can read own attempts"
  on public.scenario_attempts for select
  using (user_id = auth.uid());

create policy "Users can update own attempts"
  on public.scenario_attempts for update
  using (user_id = auth.uid());

create policy "Instructors can read all attempts"
  on public.scenario_attempts for select
  using (current_user_role() in ('instructor', 'admin'));

-- Step events
drop policy if exists "Users can insert step events for own attempts" on public.step_events;
drop policy if exists "Users can read own step events" on public.step_events;
drop policy if exists "Instructors can read all step events" on public.step_events;

create policy "Users can insert step events for own attempts"
  on public.step_events for insert
  with check (
    exists (
      select 1 from public.scenario_attempts
      where id = attempt_id and user_id = auth.uid()
    )
  );

create policy "Users can read own step events"
  on public.step_events for select
  using (
    exists (
      select 1 from public.scenario_attempts
      where id = attempt_id and user_id = auth.uid()
    )
  );

create policy "Instructors can read all step events"
  on public.step_events for select
  using (current_user_role() in ('instructor', 'admin'));

-- Tutorial events
drop policy if exists "Users can insert own tutorial events" on public.tutorial_events;
drop policy if exists "Users can read own tutorial events" on public.tutorial_events;
drop policy if exists "Instructors can read all tutorial events" on public.tutorial_events;

create policy "Users can insert own tutorial events"
  on public.tutorial_events for insert
  with check (user_id = auth.uid());

create policy "Users can read own tutorial events"
  on public.tutorial_events for select
  using (user_id = auth.uid());

create policy "Instructors can read all tutorial events"
  on public.tutorial_events for select
  using (current_user_role() in ('instructor', 'admin'));

-- AI outputs
drop policy if exists "Users can read own AI outputs" on public.ai_outputs;
drop policy if exists "Instructors can read all AI outputs" on public.ai_outputs;

create policy "Users can read own AI outputs"
  on public.ai_outputs for select
  using (
    exists (
      select 1 from public.scenario_attempts
      where id = attempt_id and user_id = auth.uid()
    )
  );

create policy "Instructors can read all AI outputs"
  on public.ai_outputs for select
  using (current_user_role() in ('instructor', 'admin'));
