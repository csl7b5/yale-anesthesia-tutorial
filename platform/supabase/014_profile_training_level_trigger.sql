-- 014: Copy training_level from signup metadata into profiles (extends 013).
-- Run in Supabase Dashboard → SQL Editor if you already applied 013 without training_level.

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
