-- 020_case_assignments.sql
-- Table for assigning private (or public) cases to specific students/cohorts

CREATE TABLE IF NOT EXISTS public.case_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  scenario_id      uuid NOT NULL REFERENCES public.generated_scenarios(id) ON DELETE CASCADE,
  assigned_to      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  status           text NOT NULL DEFAULT 'assigned' 
                   CHECK (status IN ('assigned', 'started', 'completed')),
                   
  notified_at      timestamptz,
  started_at       timestamptz,
  completed_at     timestamptz,
  
  UNIQUE (scenario_id, assigned_to) -- A user can only be assigned a specific case once
);

CREATE INDEX IF NOT EXISTS idx_case_assignments_scenario ON public.case_assignments(scenario_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_user ON public.case_assignments(assigned_to);

-- RLS
ALTER TABLE public.case_assignments ENABLE ROW LEVEL SECURITY;

-- Students can see their own assignments
DO $$ BEGIN
  CREATE POLICY "Students see their own assignments"
    ON public.case_assignments FOR SELECT
    USING (assigned_to = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Students can update their own assignments (e.g. to mark started/completed)
DO $$ BEGIN
  CREATE POLICY "Students can update their own assignments"
    ON public.case_assignments FOR UPDATE
    USING (assigned_to = auth.uid())
    WITH CHECK (assigned_to = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Instructors can manage all assignments
DO $$ BEGIN
  CREATE POLICY "Instructors manage all assignments"
    ON public.case_assignments FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'instructor'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.case_assignments IS
  'Tracks which generated cases are assigned to which students, along with their progress status.';
