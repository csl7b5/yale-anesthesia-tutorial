-- 008: Ensure existing auth users have a profile row.
-- Run this if the trigger didn't fire for users who signed up
-- before the trigger was created.

insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(u.email, '@', 1)
  )
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
