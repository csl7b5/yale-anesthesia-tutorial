-- 029: Scope generated cases, motifs, and cohorts to the instructor's institution.
-- Run AFTER 027_institutions.sql and 028_institution_scope.sql.

CREATE OR REPLACE FUNCTION public.current_user_institution_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_institution_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_institution_id() TO authenticated;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.current_user_institution_id() TO service_role;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Compatibility names used by older Edge Function drafts
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_institution_id();
$$;

CREATE OR REPLACE FUNCTION public.resolve_school_id(raw_text text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.match_institution(raw_text, NULL);
$$;

GRANT EXECUTE ON FUNCTION public.current_user_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_school_id(text) TO anon, authenticated;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.current_user_school_id() TO service_role;
  GRANT EXECUTE ON FUNCTION public.resolve_school_id(text) TO service_role;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.scenario_motifs
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

ALTER TABLE public.generated_scenarios
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scenario_motifs_institution
  ON public.scenario_motifs (institution_id);
CREATE INDEX IF NOT EXISTS idx_generated_scenarios_institution
  ON public.generated_scenarios (institution_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_institution
  ON public.cohorts (institution_id);

UPDATE public.generated_scenarios gs
SET institution_id = p.institution_id
FROM public.profiles p
WHERE gs.institution_id IS NULL
  AND p.id = gs.created_by
  AND p.institution_id IS NOT NULL;

UPDATE public.cohorts c
SET institution_id = p.institution_id
FROM public.profiles p
WHERE c.institution_id IS NULL
  AND p.id = c.created_by
  AND p.institution_id IS NOT NULL;

-- Existing Yale-hosted cases/cohorts with no creator match → Yale SOM
UPDATE public.generated_scenarios
SET institution_id = i.id
FROM public.institutions i
WHERE generated_scenarios.institution_id IS NULL
  AND i.short_name = 'Yale'
  AND i.kind = 'md';

UPDATE public.cohorts
SET institution_id = i.id
FROM public.institutions i
WHERE cohorts.institution_id IS NULL
  AND i.short_name = 'Yale'
  AND i.kind = 'md';

CREATE OR REPLACE FUNCTION public.stamp_row_institution_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.institution_id IS NULL THEN
    NEW.institution_id := public.current_user_institution_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_cohort_institution ON public.cohorts;
CREATE TRIGGER trg_stamp_cohort_institution
  BEFORE INSERT ON public.cohorts
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_row_institution_id();

DROP TRIGGER IF EXISTS trg_stamp_motif_institution ON public.scenario_motifs;
CREATE TRIGGER trg_stamp_motif_institution
  BEFORE INSERT ON public.scenario_motifs
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_row_institution_id();

DROP TRIGGER IF EXISTS trg_stamp_case_institution ON public.generated_scenarios;
CREATE TRIGGER trg_stamp_case_institution
  BEFORE INSERT ON public.generated_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_row_institution_id();

CREATE OR REPLACE FUNCTION public.enforce_cohort_institution_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cohort_inst uuid;
  member_inst uuid;
BEGIN
  SELECT institution_id INTO cohort_inst FROM public.cohorts WHERE id = NEW.cohort_id;
  SELECT institution_id INTO member_inst FROM public.profiles WHERE id = NEW.user_id;

  IF cohort_inst IS NOT NULL
     AND member_inst IS NOT NULL
     AND cohort_inst IS DISTINCT FROM member_inst THEN
    RAISE EXCEPTION 'Learners can only be added to cohorts at their own school.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cohort_members_school_guard ON public.cohort_members;
DROP TRIGGER IF EXISTS cohort_members_institution_guard ON public.cohort_members;
CREATE TRIGGER cohort_members_institution_guard
  BEFORE INSERT OR UPDATE ON public.cohort_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_cohort_institution_member();

-- ── Motifs: shared catalog (NULL) + school-owned ─────────────────────────────

DROP POLICY IF EXISTS "active motifs visible to authenticated users" ON public.scenario_motifs;
DROP POLICY IF EXISTS "instructors can manage motifs" ON public.scenario_motifs;
DROP POLICY IF EXISTS "users read shared or school motifs" ON public.scenario_motifs;
DROP POLICY IF EXISTS "staff manage school motifs" ON public.scenario_motifs;
DROP POLICY IF EXISTS "staff update school motifs" ON public.scenario_motifs;
DROP POLICY IF EXISTS "staff delete school motifs" ON public.scenario_motifs;

CREATE POLICY "users read shared or school motifs"
  ON public.scenario_motifs FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      public.current_user_role() IN ('instructor', 'admin')
      OR is_active = true
    )
    AND (
      public.is_master_admin()
      OR public.current_learner_scope() = 'global'
      OR institution_id IS NULL
      OR institution_id IS NOT DISTINCT FROM public.current_user_institution_id()
    )
  );

CREATE POLICY "staff insert school motifs"
  ON public.scenario_motifs FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('instructor', 'admin')
    AND (
      public.is_master_admin()
      OR public.current_learner_scope() = 'global'
      OR institution_id IS NOT DISTINCT FROM public.current_user_institution_id()
    )
  );

CREATE POLICY "staff update school motifs"
  ON public.scenario_motifs FOR UPDATE
  USING (
    public.current_user_role() IN ('instructor', 'admin')
    AND (
      public.is_master_admin()
      OR public.current_learner_scope() = 'global'
      OR institution_id IS NOT DISTINCT FROM public.current_user_institution_id()
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('instructor', 'admin')
    AND (
      public.is_master_admin()
      OR public.current_learner_scope() = 'global'
      OR institution_id IS NOT DISTINCT FROM public.current_user_institution_id()
    )
  );

CREATE POLICY "staff delete school motifs"
  ON public.scenario_motifs FOR DELETE
  USING (
    public.current_user_role() IN ('instructor', 'admin')
    AND (
      public.is_master_admin()
      OR public.current_learner_scope() = 'global'
      OR institution_id IS NOT DISTINCT FROM public.current_user_institution_id()
    )
  );

-- ── Generated cases ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "students see approved generated scenarios" ON public.generated_scenarios;
DROP POLICY IF EXISTS "students see public approved scenarios" ON public.generated_scenarios;
DROP POLICY IF EXISTS "Students can read published cases" ON public.generated_scenarios;
DROP POLICY IF EXISTS "instructors manage generated scenarios" ON public.generated_scenarios;
DROP POLICY IF EXISTS "students read school public or assigned cases" ON public.generated_scenarios;
DROP POLICY IF EXISTS "staff read school generated scenarios" ON public.generated_scenarios;
DROP POLICY IF EXISTS "staff insert school generated scenarios" ON public.generated_scenarios;
DROP POLICY IF EXISTS "staff update school generated scenarios" ON public.generated_scenarios;
DROP POLICY IF EXISTS "staff delete school generated scenarios" ON public.generated_scenarios;

CREATE POLICY "students read school public or assigned cases"
  ON public.generated_scenarios FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND status = 'approved'
    AND (is_archived IS NULL OR is_archived = false)
    AND (
      (
        visibility = 'public'
        AND institution_id IS NOT NULL
        AND institution_id = public.current_user_institution_id()
      )
      OR EXISTS (
        SELECT 1
        FROM public.case_assignments ca
        WHERE ca.scenario_id = generated_scenarios.id
          AND ca.assigned_to = auth.uid()
      )
    )
  );

CREATE POLICY "staff read school generated scenarios"
  ON public.generated_scenarios FOR SELECT
  USING (
    public.current_user_role() IN ('instructor', 'admin')
    AND (
      public.is_master_admin()
      OR public.current_learner_scope() = 'global'
      OR institution_id IS NOT DISTINCT FROM public.current_user_institution_id()
    )
  );

CREATE POLICY "staff insert school generated scenarios"
  ON public.generated_scenarios FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('instructor', 'admin')
    AND (
      public.is_master_admin()
      OR public.current_learner_scope() = 'global'
      OR institution_id IS NOT DISTINCT FROM public.current_user_institution_id()
    )
  );

CREATE POLICY "staff update school generated scenarios"
  ON public.generated_scenarios FOR UPDATE
  USING (
    public.current_user_role() IN ('instructor', 'admin')
    AND (
      public.is_master_admin()
      OR public.current_learner_scope() = 'global'
      OR institution_id IS NOT DISTINCT FROM public.current_user_institution_id()
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('instructor', 'admin')
    AND (
      public.is_master_admin()
      OR public.current_learner_scope() = 'global'
      OR institution_id IS NOT DISTINCT FROM public.current_user_institution_id()
    )
  );

CREATE POLICY "staff delete school generated scenarios"
  ON public.generated_scenarios FOR DELETE
  USING (
    public.current_user_role() IN ('instructor', 'admin')
    AND (
      public.is_master_admin()
      OR public.current_learner_scope() = 'global'
      OR institution_id IS NOT DISTINCT FROM public.current_user_institution_id()
    )
  );

-- ── Cohorts: scoped instructors only see their school's cohorts ──────────────

DROP POLICY IF EXISTS "Instructors can manage cohorts" ON public.cohorts;
DROP POLICY IF EXISTS "Staff manage school cohorts" ON public.cohorts;

CREATE POLICY "Instructors can manage cohorts"
  ON public.cohorts FOR ALL
  USING (
    public.is_master_admin()
    OR (
      public.current_user_role() IN ('instructor', 'admin')
      AND (
        public.current_learner_scope() = 'global'
        OR created_by = auth.uid()
        OR institution_id IS NOT DISTINCT FROM public.current_user_institution_id()
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
        OR institution_id IS NOT DISTINCT FROM public.current_user_institution_id()
      )
    )
  );

DROP POLICY IF EXISTS "Instructors manage all assignments" ON public.case_assignments;
DROP POLICY IF EXISTS "Instructors manage visible assignments" ON public.case_assignments;
DROP POLICY IF EXISTS "Staff manage school assignments" ON public.case_assignments;

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
