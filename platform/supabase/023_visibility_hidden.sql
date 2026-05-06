-- Migration 023: Add 'hidden' as a valid visibility value for generated_scenarios
-- This allows instructors to completely hide a case from all students.

-- 1. Drop the old CHECK constraint and replace it with an expanded one
ALTER TABLE public.generated_scenarios
  DROP CONSTRAINT IF EXISTS generated_scenarios_visibility_check;

ALTER TABLE public.generated_scenarios
  ADD CONSTRAINT generated_scenarios_visibility_check
    CHECK (visibility IN ('public', 'private', 'hidden'));

-- 2. Update the student RLS policy so 'hidden' cases are never shown to students
DROP POLICY IF EXISTS "Students can read published cases" ON public.generated_scenarios;

CREATE POLICY "Students can read published cases"
  ON public.generated_scenarios FOR SELECT
  USING (
    status = 'approved'
    AND visibility = 'public'
    AND (is_archived IS NULL OR is_archived = false)
  );
