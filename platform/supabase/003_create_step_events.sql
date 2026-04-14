-- 003: Per-step answer events within a scenario attempt

create table if not exists public.step_events (
  id              uuid primary key default gen_random_uuid(),
  attempt_id      uuid not null references public.scenario_attempts(id) on delete cascade,
  step_number     integer not null,
  answer_index    integer not null,
  is_correct      boolean not null,
  latency_seconds integer not null,
  created_at      timestamptz not null default now()
);

create index idx_steps_attempt on public.step_events(attempt_id);

comment on table public.step_events is
  'One row per answer click inside a scenario attempt.';
