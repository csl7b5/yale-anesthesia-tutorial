-- 012: Pyxis exploration events (drawers, dwell, items, supplies) for authenticated learners.

create table if not exists public.pyxis_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  event_type text not null check (event_type in (
    'page_tab_switch',
    'drawer_open',
    'contents_dwell',
    'supply_bin_open',
    'gas_canister_open',
    'controlled_cell_open',
    'item_detail_view',
    'item_detail_dwell',
    'back_to_drawer',
    'team_bubble_click',
    'email_link_click',
    'session_coverage',
    'feedback_opened'
  )),
  tab_id text,
  drawer_type text,
  drawer_id text,
  bin_id text,
  item_type text,
  item_id text,
  dwell_seconds integer,
  is_repeat boolean,
  session_unique_drawers integer,
  session_unique_items integer,
  extra jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pyxis_events_user_created
  on public.pyxis_events (user_id, created_at desc);

create index if not exists idx_pyxis_events_session
  on public.pyxis_events (session_id);

create index if not exists idx_pyxis_events_drawer
  on public.pyxis_events (user_id, drawer_id)
  where drawer_id is not null;

comment on table public.pyxis_events is
  'Interactive Pyxis: drawer visits, dwell time, supply/item views — mirrors GA4 for signed-in users.';

alter table public.pyxis_events enable row level security;

create policy "Users can insert own pyxis events"
  on public.pyxis_events for insert
  with check (auth.uid() = user_id);

create policy "Users can read own pyxis events"
  on public.pyxis_events for select
  using (auth.uid() = user_id);

create policy "Instructors can read all pyxis events"
  on public.pyxis_events for select
  using (current_user_role() in ('instructor', 'admin'));
