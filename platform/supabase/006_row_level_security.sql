-- 006: Row-Level Security policies
-- Ensures students see only their own data; instructors see all.

-- ── Profiles ─────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Instructors can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('instructor', 'admin')
    )
  );

-- ── Scenario attempts ────────────────────────────────────────────────────────
alter table public.scenario_attempts enable row level security;

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
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('instructor', 'admin')
    )
  );

-- ── Step events ──────────────────────────────────────────────────────────────
alter table public.step_events enable row level security;

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
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('instructor', 'admin')
    )
  );

-- ── Tutorial events ──────────────────────────────────────────────────────────
alter table public.tutorial_events enable row level security;

create policy "Users can insert own tutorial events"
  on public.tutorial_events for insert
  with check (user_id = auth.uid());

create policy "Users can read own tutorial events"
  on public.tutorial_events for select
  using (user_id = auth.uid());

create policy "Instructors can read all tutorial events"
  on public.tutorial_events for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('instructor', 'admin')
    )
  );

-- ── AI outputs ───────────────────────────────────────────────────────────────
alter table public.ai_outputs enable row level security;

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
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('instructor', 'admin')
    )
  );
