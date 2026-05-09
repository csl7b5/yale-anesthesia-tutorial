-- Allow pyxis_events.checkin quiz answers for instructor analytics.

alter table public.pyxis_events drop constraint if exists pyxis_events_event_type_check;

alter table public.pyxis_events add constraint pyxis_events_event_type_check check (event_type in (
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
  'feedback_opened',
  'pyxis_checkin_answer'
));
