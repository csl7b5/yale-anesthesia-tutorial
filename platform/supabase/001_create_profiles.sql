-- 001: User profiles (extends Supabase auth.users)
-- Run this in the Supabase Dashboard → SQL Editor

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'student'
              check (role in ('student', 'instructor', 'admin')),
  display_name text,
  institution  text not null default 'Yale',
  training_level text,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'One row per authenticated user; role gates dashboard access.';

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, institution, training_level)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'school'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'institution'), ''),
      'Yale'
    ),
    nullif(trim(new.raw_user_meta_data ->> 'training_level'), '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
