-- 028: Institution-scoped instructor visibility + fuzzy-match existing rows
-- Run AFTER 027_institutions.sql in the Supabase SQL Editor, then run 029.
-- The last two SELECT results are the match report for current students and
-- educator requests (including the UCSF request). Re-runnable.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Profile columns ──────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS institution_other text,
  ADD COLUMN IF NOT EXISTS learner_scope text;

ALTER TABLE public.profiles
  ALTER COLUMN institution SET DEFAULT '';

-- Existing instructors keep a global learner list (Yale faculty today).
-- Newly provisioned educators default to institution-scoped.
UPDATE public.profiles
SET learner_scope = 'global'
WHERE role IN ('instructor', 'admin')
  AND learner_scope IS NULL;

UPDATE public.profiles
SET learner_scope = 'institution'
WHERE learner_scope IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN learner_scope SET DEFAULT 'institution';

ALTER TABLE public.profiles
  ALTER COLUMN learner_scope SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_learner_scope_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_learner_scope_check
  CHECK (learner_scope IN ('global', 'institution'));

CREATE INDEX IF NOT EXISTS idx_profiles_institution_id
  ON public.profiles (institution_id)
  WHERE institution_id IS NOT NULL;

ALTER TABLE public.educator_requests
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

-- ── Matching helpers ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.normalize_institution_query(q text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both FROM regexp_replace(lower(coalesce(q, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.match_institution(q text, email text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  nq text := public.normalize_institution_query(q);
  domain text := lower(nullif(split_part(coalesce(email, ''), '@', 2), ''));
  skip_name boolean := false;
  email_hits uuid[];
  name_hits uuid[];
  best uuid;
  best_score real;
  second_score real;
  prefer_allied boolean := false;
BEGIN
  IF nq IN ('', 'other', 'n a', 'na', 'none', 'visiting other institution', 'visiting', 'not listed') THEN
    skip_name := true;
  END IF;

  prefer_allied :=
    nq ~ '\y(nursing|nurs|pa program|physician associate|physician assistant|public health|ysph|ysn)\y';

  IF domain IS NOT NULL THEN
    SELECT coalesce(array_agg(i.id), '{}')
    INTO email_hits
    FROM public.institutions i
    WHERE EXISTS (
      SELECT 1
      FROM unnest(i.email_domains) d
      WHERE domain = lower(d)
         OR domain LIKE '%.' || lower(d)
    );

    IF array_length(email_hits, 1) = 1 THEN
      -- Unique domain. Still prefer a name match if the query names a different school.
      IF skip_name THEN
        RETURN email_hits[1];
      END IF;
    ELSIF array_length(email_hits, 1) > 1 THEN
      -- yale.edu → multiple programs. Prefer MD unless the query names an allied program.
      SELECT i.id
      INTO best
      FROM public.institutions i
      WHERE i.id = ANY (email_hits)
      ORDER BY
        CASE
          WHEN prefer_allied AND i.kind = 'allied' THEN 0
          WHEN (NOT prefer_allied) AND i.kind = 'md' THEN 0
          ELSE 1
        END,
        CASE WHEN i.short_name IS NOT NULL THEN 0 ELSE 1 END,
        i.canonical_name
      LIMIT 1;

      IF skip_name THEN
        RETURN best;
      END IF;
    END IF;
  END IF;

  IF skip_name THEN
    RETURN CASE
      WHEN array_length(email_hits, 1) = 1 THEN email_hits[1]
      ELSE best
    END;
  END IF;

  -- Exact canonical / short name / alias (normalized)
  SELECT coalesce(array_agg(i.id), '{}')
  INTO name_hits
  FROM public.institutions i
  WHERE public.normalize_institution_query(i.canonical_name) = nq
     OR public.normalize_institution_query(i.short_name) = nq
     OR EXISTS (
          SELECT 1
          FROM unnest(i.aliases) a
          WHERE public.normalize_institution_query(a) = nq
        );

  IF array_length(name_hits, 1) = 1 THEN
    RETURN name_hits[1];
  END IF;

  IF array_length(name_hits, 1) > 1 THEN
    SELECT i.id
    INTO best
    FROM public.institutions i
    WHERE i.id = ANY (name_hits)
    ORDER BY
      CASE
        WHEN email_hits IS NOT NULL AND i.id = ANY (email_hits) THEN 0
        ELSE 1
      END,
      CASE
        WHEN prefer_allied AND i.kind = 'allied' THEN 0
        WHEN (NOT prefer_allied) AND i.kind = 'md' THEN 0
        ELSE 1
      END,
      i.canonical_name
    LIMIT 1;
    RETURN best;
  END IF;

  -- Unique "contains" match for slightly longer queries ("ucsf som", "yale med")
  IF char_length(nq) >= 6 THEN
    SELECT coalesce(array_agg(i.id), '{}')
    INTO name_hits
    FROM public.institutions i
    WHERE public.normalize_institution_query(i.canonical_name) LIKE '%' || nq || '%'
       OR public.normalize_institution_query(i.short_name) LIKE '%' || nq || '%'
       OR EXISTS (
            SELECT 1
            FROM unnest(i.aliases) a
            WHERE public.normalize_institution_query(a) LIKE '%' || nq || '%'
               OR nq LIKE '%' || public.normalize_institution_query(a) || '%'
          );

    IF array_length(name_hits, 1) = 1 THEN
      RETURN name_hits[1];
    END IF;
  END IF;

  -- Trigram fuzzy match for typos / longer free text
  IF char_length(nq) >= 8 THEN
    SELECT ranked.id, ranked.score
    INTO best, best_score
    FROM (
      SELECT
        i.id,
        greatest(
          similarity(nq, public.normalize_institution_query(i.canonical_name)),
          coalesce(similarity(nq, public.normalize_institution_query(i.short_name)), 0),
          (
            SELECT max(similarity(nq, public.normalize_institution_query(a)))
            FROM unnest(i.aliases) a
          )
        ) AS score
      FROM public.institutions i
    ) ranked
    ORDER BY ranked.score DESC, ranked.id
    LIMIT 1;

    SELECT ranked.score
    INTO second_score
    FROM (
      SELECT
        i.id,
        greatest(
          similarity(nq, public.normalize_institution_query(i.canonical_name)),
          coalesce(similarity(nq, public.normalize_institution_query(i.short_name)), 0),
          (
            SELECT max(similarity(nq, public.normalize_institution_query(a)))
            FROM unnest(i.aliases) a
          )
        ) AS score
      FROM public.institutions i
    ) ranked
    ORDER BY ranked.score DESC, ranked.id
    OFFSET 1
    LIMIT 1;

    IF best IS NOT NULL
       AND best_score >= 0.42
       AND (second_score IS NULL OR best_score - second_score >= 0.06) THEN
      RETURN best;
    END IF;
  END IF;

  -- Fall back to unique email domain if name matching failed
  IF array_length(email_hits, 1) = 1 THEN
    RETURN email_hits[1];
  END IF;
  RETURN best; -- may be null, or the yale.edu MD preference when name did not match
END;
$$;

REVOKE ALL ON FUNCTION public.match_institution(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_institution(text, text) TO authenticated;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.match_institution(text, text) TO service_role;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── Visibility helpers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email::text) = 'firenixx2k@gmail.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_learner_scope()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(learner_scope, 'institution')
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_read_learner_data(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me public.profiles%ROWTYPE;
  them public.profiles%ROWTYPE;
BEGIN
  IF target_user_id IS NOT NULL AND target_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  IF public.is_master_admin() THEN
    RETURN true;
  END IF;

  SELECT * INTO me FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND OR me.role NOT IN ('instructor', 'admin') THEN
    RETURN false;
  END IF;
  IF coalesce(me.learner_scope, 'institution') = 'global' THEN
    RETURN true;
  END IF;
  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO them FROM public.profiles WHERE id = target_user_id;
  IF NOT FOUND OR them.role IS DISTINCT FROM 'student' THEN
    RETURN false;
  END IF;

  IF me.institution_id IS NOT NULL AND them.institution_id = me.institution_id THEN
    RETURN true;
  END IF;

  IF me.institution_id IS NULL
     AND length(btrim(coalesce(me.institution_other, ''))) > 0
     AND lower(btrim(coalesce(them.institution_other, them.institution, '')))
         = lower(btrim(me.institution_other)) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_learner_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_learner_data(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.current_learner_scope() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_learner_scope() TO authenticated;

REVOKE ALL ON FUNCTION public.is_master_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated;

-- ── Keep display name in sync; lock privileged fields ────────────────────────

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
    -- Institution-scoped instructors cannot switch schools to peek at another roster
    IF OLD.role IN ('instructor', 'admin')
       AND coalesce(OLD.learner_scope, 'institution') = 'institution' THEN
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

DROP TRIGGER IF EXISTS trg_sync_profile_institution ON public.profiles;
CREATE TRIGGER trg_sync_profile_institution
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_institution();

-- ── Signup: resolve picker id / Other text / legacy school string ────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_other text;
  v_school text;
  v_display text;
BEGIN
  BEGIN
    v_id := nullif(trim(new.raw_user_meta_data ->> 'institution_id'), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_id := NULL;
  END;

  IF v_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutions WHERE id = v_id) THEN
    v_id := NULL;
  END IF;

  v_other := nullif(trim(new.raw_user_meta_data ->> 'institution_other'), '');
  v_school := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'school'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'institution'), '')
  );

  IF v_id IS NULL THEN
    v_id := public.match_institution(coalesce(v_other, v_school), new.email);
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT canonical_name INTO v_display FROM public.institutions WHERE id = v_id;
    v_other := NULL;
  ELSIF v_other IS NOT NULL THEN
    v_display := v_other;
  ELSE
    v_display := coalesce(v_school, '');
    IF v_display <> '' THEN
      v_other := v_display;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, display_name, institution, institution_id, institution_other, training_level)
  VALUES (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    coalesce(v_display, ''),
    v_id,
    v_other,
    nullif(trim(new.raw_user_meta_data ->> 'training_level'), '')
  );
  RETURN new;
END;
$$;

-- ── Educator request RPC ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.submit_educator_request(text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_educator_request(
  p_name             text,
  p_email            text,
  p_institution      text,
  p_role_title       text DEFAULT NULL,
  p_use_case         text DEFAULT NULL,
  p_message          text DEFAULT NULL,
  p_initial_password text DEFAULT NULL,
  p_institution_id   uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  pwd    text := nullif(trim(p_initial_password), '');
  v_id   uuid := p_institution_id;
  v_name text;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF (p_institution IS NULL OR btrim(p_institution) = '') AND v_id IS NULL THEN
    RAISE EXCEPTION 'Institution is required';
  END IF;
  IF pwd IS NOT NULL AND length(pwd) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters when provided';
  END IF;

  IF v_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutions WHERE id = v_id) THEN
    v_id := NULL;
  END IF;
  IF v_id IS NULL THEN
    v_id := public.match_institution(p_institution, p_email);
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT canonical_name INTO v_name FROM public.institutions WHERE id = v_id;
  ELSE
    v_name := btrim(coalesce(p_institution, ''));
  END IF;

  INSERT INTO public.educator_requests (name, email, institution, institution_id, role_title, use_case, message, status)
  VALUES (
    btrim(p_name),
    lower(btrim(p_email)),
    v_name,
    v_id,
    nullif(btrim(p_role_title), ''),
    nullif(btrim(p_use_case), ''),
    nullif(btrim(p_message), ''),
    'pending'
  )
  RETURNING id INTO new_id;

  IF pwd IS NOT NULL THEN
    INSERT INTO public.educator_request_secrets (request_id, initial_password)
    VALUES (new_id, pwd);
  END IF;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_educator_request(text, text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_educator_request(text, text, text, text, text, text, text, uuid)
  TO anon, authenticated;

-- ── Fuzzy-match existing students, instructors, and educator requests ────────

UPDATE public.profiles p
SET institution_id = public.match_institution(p.institution, u.email)
FROM auth.users u
WHERE u.id = p.id
  AND p.institution_id IS NULL
  AND public.match_institution(p.institution, u.email) IS NOT NULL;

-- Unmatched non-empty free text becomes "Other"
UPDATE public.profiles
SET institution_other = nullif(btrim(institution), '')
WHERE institution_id IS NULL
  AND institution_other IS NULL
  AND nullif(btrim(institution), '') IS NOT NULL
  AND lower(btrim(institution)) <> 'yale';

-- Default leftover "Yale" with no id (should be rare after match) → Yale SOM via rematch
UPDATE public.profiles p
SET institution_id = i.id
FROM public.institutions i
WHERE p.institution_id IS NULL
  AND lower(btrim(p.institution)) = 'yale'
  AND i.short_name = 'Yale'
  AND i.kind = 'md';

UPDATE public.educator_requests r
SET institution_id = public.match_institution(r.institution, r.email)
WHERE r.institution_id IS NULL
  AND public.match_institution(r.institution, r.email) IS NOT NULL;

UPDATE public.educator_requests r
SET institution = i.canonical_name
FROM public.institutions i
WHERE r.institution_id = i.id
  AND r.institution IS DISTINCT FROM i.canonical_name;

-- Display names for matched profiles are filled by the BEFORE UPDATE trigger
UPDATE public.profiles
SET institution = institution
WHERE institution_id IS NOT NULL;

-- ── RLS: instructors no longer see every learner by default ──────────────────

DROP POLICY IF EXISTS "Instructors can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Instructors can read visible profiles" ON public.profiles;
CREATE POLICY "Instructors can read visible profiles"
  ON public.profiles FOR SELECT
  USING (public.can_read_learner_data(id));

DROP POLICY IF EXISTS "Instructors can read all attempts" ON public.scenario_attempts;
DROP POLICY IF EXISTS "Instructors can read visible attempts" ON public.scenario_attempts;
CREATE POLICY "Instructors can read visible attempts"
  ON public.scenario_attempts FOR SELECT
  USING (public.can_read_learner_data(user_id));

DROP POLICY IF EXISTS "Instructors can read all step events" ON public.step_events;
DROP POLICY IF EXISTS "Instructors can read visible step events" ON public.step_events;
CREATE POLICY "Instructors can read visible step events"
  ON public.step_events FOR SELECT
  USING (
    public.can_read_learner_data(
      (SELECT sa.user_id FROM public.scenario_attempts sa WHERE sa.id = attempt_id)
    )
  );

DROP POLICY IF EXISTS "Instructors can read all tutorial events" ON public.tutorial_events;
DROP POLICY IF EXISTS "Instructors can read visible tutorial events" ON public.tutorial_events;
CREATE POLICY "Instructors can read visible tutorial events"
  ON public.tutorial_events FOR SELECT
  USING (public.can_read_learner_data(user_id));

DROP POLICY IF EXISTS "Instructors can read all AI outputs" ON public.ai_outputs;
DROP POLICY IF EXISTS "Instructors can read visible AI outputs" ON public.ai_outputs;
CREATE POLICY "Instructors can read visible AI outputs"
  ON public.ai_outputs FOR SELECT
  USING (
    public.can_read_learner_data(
      (SELECT sa.user_id FROM public.scenario_attempts sa WHERE sa.id = attempt_id)
    )
  );

DROP POLICY IF EXISTS "Instructors can read all pyxis events" ON public.pyxis_events;
DROP POLICY IF EXISTS "Instructors can read visible pyxis events" ON public.pyxis_events;
CREATE POLICY "Instructors can read visible pyxis events"
  ON public.pyxis_events FOR SELECT
  USING (public.can_read_learner_data(user_id));

DROP POLICY IF EXISTS "Instructors can read all chat_queries" ON public.chat_queries;
DROP POLICY IF EXISTS "Instructors can read visible chat_queries" ON public.chat_queries;
CREATE POLICY "Instructors can read visible chat_queries"
  ON public.chat_queries FOR SELECT
  USING (public.can_read_learner_data(user_id));

DROP POLICY IF EXISTS "Instructors can manage cohorts" ON public.cohorts;
CREATE POLICY "Instructors can manage cohorts"
  ON public.cohorts FOR ALL
  USING (
    public.is_master_admin()
    OR (
      public.current_user_role() IN ('instructor', 'admin')
      AND (
        public.current_learner_scope() = 'global'
        OR created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_master_admin()
    OR (
      public.current_user_role() IN ('instructor', 'admin')
      AND (
        public.current_learner_scope() = 'global'
        OR created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Instructors can manage cohort members" ON public.cohort_members;
CREATE POLICY "Instructors can manage cohort members"
  ON public.cohort_members FOR ALL
  USING (
    user_id = auth.uid()
    OR public.can_read_learner_data(user_id)
  )
  WITH CHECK (public.can_read_learner_data(user_id));

DROP POLICY IF EXISTS "Instructors manage all assignments" ON public.case_assignments;
DROP POLICY IF EXISTS "Instructors manage visible assignments" ON public.case_assignments;
CREATE POLICY "Instructors manage visible assignments"
  ON public.case_assignments FOR ALL
  USING (
    public.current_user_role() IN ('instructor', 'admin')
    AND public.can_read_learner_data(assigned_to)
  )
  WITH CHECK (
    public.current_user_role() IN ('instructor', 'admin')
    AND public.can_read_learner_data(assigned_to)
  );

NOTIFY pgrst, 'reload schema';

-- ── Match report (last result set in the SQL editor) ─────────────────────────

SELECT
  p.role,
  CASE
    WHEN p.institution_id IS NOT NULL THEN 'matched'
    WHEN nullif(btrim(coalesce(p.institution_other, '')), '') IS NOT NULL THEN 'other'
    ELSE 'unset'
  END AS match_status,
  coalesce(i.short_name, i.canonical_name, p.institution_other, p.institution, '(blank)') AS label,
  count(*) AS n
FROM public.profiles p
LEFT JOIN public.institutions i ON i.id = p.institution_id
GROUP BY 1, 2, 3
ORDER BY 1, 2, 4 DESC;

SELECT
  r.email,
  r.institution AS stored_name,
  i.canonical_name AS matched_school,
  r.status
FROM public.educator_requests r
LEFT JOIN public.institutions i ON i.id = r.institution_id
ORDER BY r.created_at DESC;
