-- 015: Add scenario linkage + quiz_answer support to tutorial_events

alter table public.tutorial_events
  add column if not exists scenario_attempt_id uuid
  references public.scenario_attempts(id) on delete set null;

create index if not exists idx_tutorial_events_attempt_id
  on public.tutorial_events(scenario_attempt_id);

alter table public.tutorial_events
  drop constraint if exists tutorial_events_event_type_check;

alter table public.tutorial_events
  add constraint tutorial_events_event_type_check
  check (event_type in (
    'opened', 'closed',
    'pathology_selected', 'tab_switched',
    'preset_selected', 'reset',
    'quiz_answer'
  ));
