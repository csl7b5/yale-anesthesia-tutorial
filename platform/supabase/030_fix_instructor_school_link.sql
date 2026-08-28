-- 030_fix_instructor_school_link.sql
-- Allow a one-time institution_id fill for scoped instructors whose school
-- text is set (e.g. "Stanford") but the catalog FK was never written.
-- Also backfill those rows and expose a self-heal RPC for the dashboard.

CREATE OR REPLACE FUNCTION public.sync_profile_institution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  canon text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND auth.uid() IS NOT NULL
     AND auth.uid() = NEW.id
     AND NOT public.is_master_admin() THEN
    NEW.role := OLD.role;
    NEW.learner_scope := OLD.learner_scope;
    IF OLD.role IN ('instructor', 'admin')
       AND coalesce(OLD.learner_scope, 'institution') = 'institution'
       AND OLD.institution_id IS NOT NULL THEN
      NEW.institution_id := OLD.institution_id;
      NEW.institution_other := OLD.institution_other;
    END IF;
  END IF;

  IF NEW.institution_id IS NOT NULL THEN
    SELECT canonical_name INTO canon
    FROM public.institutions
    WHERE id = NEW.institution_id;
    IF canon IS NULL THEN
      RAISE EXCEPTION 'Unknown institution_id';
    END IF;
    NEW.institution := canon;
    NEW.institution_other := NULL;
  ELSIF nullif(btrim(coalesce(NEW.institution_other, '')), '') IS NOT NULL THEN
    NEW.institution_other := btrim(NEW.institution_other);
    NEW.institution := NEW.institution_other;
  ELSE
    NEW.institution := coalesce(nullif(btrim(coalesce(NEW.institution, '')), ''), '');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_own_institution_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid := auth.uid();
  cur uuid;
  resolved uuid;
  inst text;
  other text;
  em text;
BEGIN
  IF pid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.institution_id, p.institution, p.institution_other
    INTO cur, inst, other
  FROM public.profiles p
  WHERE p.id = pid;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF cur IS NOT NULL THEN
    RETURN cur;
  END IF;

  SELECT u.email INTO em FROM auth.users u WHERE u.id = pid;
  resolved := public.match_institution(
    nullif(btrim(coalesce(other, inst, '')), ''),
    em
  );

  IF resolved IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.profiles
  SET institution_id = resolved
  WHERE id = pid
    AND institution_id IS NULL;

  RETURN resolved;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_own_institution_id() TO authenticated;

UPDATE public.profiles p
SET institution_id = public.match_institution(
  coalesce(nullif(btrim(p.institution_other), ''), p.institution),
  u.email
)
FROM auth.users u
WHERE u.id = p.id
  AND p.institution_id IS NULL
  AND p.role IN ('instructor', 'admin')
  AND public.match_institution(
    coalesce(nullif(btrim(p.institution_other), ''), p.institution),
    u.email
  ) IS NOT NULL;
