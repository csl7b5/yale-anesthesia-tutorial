-- 005: AI-generated debrief outputs (rule-based or LLM)

create table if not exists public.ai_outputs (
  id               uuid primary key default gen_random_uuid(),
  attempt_id       uuid not null references public.scenario_attempts(id) on delete cascade,
  source           text not null default 'rule_based'
                   check (source in ('rule_based', 'llm')),
  debrief_json     jsonb not null,
  weak_domains     text[] default '{}',
  recommended_next text,
  created_at       timestamptz not null default now()
);

create index idx_ai_attempt on public.ai_outputs(attempt_id);

comment on table public.ai_outputs is
  'Stores debrief feedback per scenario attempt for student review and educator audit.';
