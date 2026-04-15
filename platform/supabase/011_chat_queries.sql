-- 011: AI chat logs (questions + responses) — written by Edge Function (service role) only

create table if not exists public.chat_queries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  page        text not null check (page in ('pyxis', 'ventilator')),
  question    text not null,
  response    text not null,
  model       text not null default 'gpt-4o-mini',
  created_at  timestamptz not null default now()
);

create index if not exists idx_chat_queries_user_day
  on public.chat_queries (user_id, created_at desc);

comment on table public.chat_queries is
  'OpenAI assistant Q&A; one row per completed exchange. Inserts via Edge Function only.';

alter table public.chat_queries enable row level security;

-- Read own rows
create policy "Users can read own chat_queries"
  on public.chat_queries for select
  using (auth.uid() = user_id);

-- Instructors see all (for audit / dashboards)
create policy "Instructors can read all chat_queries"
  on public.chat_queries for select
  using (current_user_role() in ('instructor', 'admin'));

-- No direct client inserts — Edge Function uses service role
