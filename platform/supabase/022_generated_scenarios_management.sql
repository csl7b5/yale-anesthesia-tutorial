-- ── 022: Generated scenarios management improvements ─────────────────────────
-- Adds is_archived flag, tightens student RLS to exclude archived cases,
-- and ensures instructors can delete their own generated cases.

-- 1. Add is_archived column (soft-delete / hide from students without losing the record)
ALTER TABLE public.generated_scenarios
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_generated_scenarios_archived
  ON public.generated_scenarios(is_archived);

-- 2. Update student visibility policy to exclude archived cases
DROP POLICY IF EXISTS "students see approved generated scenarios" ON public.generated_scenarios;
CREATE POLICY "students see approved generated scenarios"
  ON public.generated_scenarios FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND status = 'approved'
    AND is_archived = false
  );

-- 3. Ensure instructors can delete generated scenarios
--    (the existing ALL policy already covers DELETE for instructors,
--     but this explicit policy makes the intent clear)
DROP POLICY IF EXISTS "instructors manage generated scenarios" ON public.generated_scenarios;
CREATE POLICY "instructors manage generated scenarios"
  ON public.generated_scenarios FOR ALL
  USING (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role IN ('instructor', 'admin')
    )
  )
  WITH CHECK (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role IN ('instructor', 'admin')
    )
  );
