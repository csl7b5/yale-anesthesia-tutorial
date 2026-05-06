-- 019_publish_schema.sql
-- Add fields to generated_scenarios to support the public/private publishing model

-- Add new columns
ALTER TABLE public.generated_scenarios 
ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
ADD COLUMN IF NOT EXISTS author_label text,
ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Set existing approved cases to public so they show up for everyone initially
UPDATE public.generated_scenarios
SET visibility = 'public', published_at = updated_at
WHERE status = 'approved';

-- Drop the old policy that let anyone see all approved cases
DROP POLICY IF EXISTS "students see approved generated scenarios" ON public.generated_scenarios;

-- Create new policies
-- 1. Anyone can view PUBLIC approved cases
CREATE POLICY "students see public approved scenarios"
  ON public.generated_scenarios FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND status = 'approved' 
    AND visibility = 'public'
  );

-- Note: "instructors manage generated scenarios" already exists in 017 and allows them to see all.
