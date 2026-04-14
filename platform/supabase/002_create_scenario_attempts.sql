-- 002: Scenario attempt records

create table if not exists public.scenario_attempts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles(id) on delete set null,
  session_id        text,
  scenario_id       text not null,
  scenario_name     text not null,
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  total_seconds     integer,
  completion_status text not null default 'in_progress'
                    check (completion_status in ('in_progress', 'completed', 'abandoned'))
);

create index idx_attempts_user   on public.scenario_attempts(user_id);
create index idx_attempts_scenario on public.scenario_attempts(scenario_id);

comment on table public.scenario_attempts is
  'One row per scenario start. Updated on completion or abandonment.';
