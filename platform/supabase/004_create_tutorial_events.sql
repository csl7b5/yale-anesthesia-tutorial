-- 004: Tutorial interaction events (monitor tutorials, TOF, etc.)

create table if not exists public.tutorial_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id) on delete set null,
  session_id      text,
  monitor         text not null,
  event_type      text not null
                  check (event_type in (
                    'opened', 'closed',
                    'pathology_selected', 'tab_switched',
                    'preset_selected', 'reset'
                  )),
  event_value     text,
  dwell_seconds   integer,
  created_at      timestamptz not null default now()
);

create index idx_tutorial_user on public.tutorial_events(user_id);

comment on table public.tutorial_events is
  'Captures monitor tutorial interactions for logged-in users.';
