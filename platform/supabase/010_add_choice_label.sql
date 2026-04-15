-- 010: Add choice_label to step_events so instructors can see what was picked

alter table public.step_events
  add column if not exists choice_label text;

comment on column public.step_events.choice_label is
  'Human-readable text of the answer option the student clicked.';
