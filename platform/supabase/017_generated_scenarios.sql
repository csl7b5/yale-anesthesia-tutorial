-- 017: Generated scenario cases — AI-produced patient cases from motif templates.
-- Pending cases require instructor approval before being shown to students.

create table if not exists public.generated_scenarios (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id) on delete set null,

  -- Source motif
  motif_id         uuid not null references public.scenario_motifs(id) on delete restrict,

  -- Full scenario JSON ready to load into the simulator.
  -- Matches the shape of SCENARIOS entries in js/ventilator.js.
  scenario_json    jsonb not null,

  -- Patient summary extracted from scenario_json for quick instructor preview
  patient_summary  text,

  -- Approval workflow
  status           text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  reviewed_by      uuid references auth.users(id) on delete set null,
  reviewed_at      timestamptz,
  reviewer_notes   text
);

create index idx_generated_scenarios_motif   on public.generated_scenarios(motif_id);
create index idx_generated_scenarios_status  on public.generated_scenarios(status);
create index idx_generated_scenarios_creator on public.generated_scenarios(created_by);

-- RLS
alter table public.generated_scenarios enable row level security;

-- Students can only see approved scenarios
create policy "students see approved generated scenarios"
  on public.generated_scenarios for select
  using (
    auth.role() = 'authenticated'
    and status = 'approved'
  );

-- Instructors can see all and manage
create policy "instructors manage generated scenarios"
  on public.generated_scenarios for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'instructor'
    )
  );

comment on table public.generated_scenarios is
  'AI-generated scenario cases from motif templates. Require instructor approval before student access.';
