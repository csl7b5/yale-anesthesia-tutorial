-- 009: Cohorts — instructor-defined groups of learners + time periods

create table if not exists public.cohorts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  start_date  date,
  end_date    date,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- Join table: which students belong to which cohort
create table if not exists public.cohort_members (
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (cohort_id, user_id)
);

create index idx_cohort_members_user on public.cohort_members(user_id);

-- RLS
alter table public.cohorts enable row level security;
alter table public.cohort_members enable row level security;

-- Only instructors/admins can manage cohorts
create policy "Instructors can manage cohorts"
  on public.cohorts for all
  using (current_user_role() in ('instructor', 'admin'))
  with check (current_user_role() in ('instructor', 'admin'));

create policy "Instructors can manage cohort members"
  on public.cohort_members for all
  using (current_user_role() in ('instructor', 'admin'))
  with check (current_user_role() in ('instructor', 'admin'));

-- Students can see which cohorts they belong to
create policy "Students can see own cohort membership"
  on public.cohort_members for select
  using (user_id = auth.uid());

create policy "Students can see cohort info for their cohorts"
  on public.cohorts for select
  using (
    exists (
      select 1 from public.cohort_members
      where cohort_id = cohorts.id and user_id = auth.uid()
    )
  );
