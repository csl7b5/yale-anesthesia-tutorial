-- 026: Secure optional signup password + auto-provisioning when approved (Edge Function cleans secrets).
--
-- Replaces anon INSERT into educator_requests with RPC so passwords never appear in educator_requests rows
-- readable via student/instructor dashboards.

ALTER TABLE public.educator_requests
  ADD COLUMN IF NOT EXISTS provisioned_at timestamptz;

COMMENT ON COLUMN public.educator_requests.provisioned_at IS
  'Set when Edge Function finishes creating/upgrading the Auth user + instructor profile.';

-- Side table: no SELECT policies → PostgREST users cannot read; service role bypasses for Edge Functions.
CREATE TABLE IF NOT EXISTS public.educator_request_secrets (
  request_id uuid PRIMARY KEY REFERENCES public.educator_requests(id) ON DELETE CASCADE,
  initial_password text NOT NULL
);

ALTER TABLE public.educator_request_secrets ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.educator_request_secrets IS
  'Temporary password submitted with instructor request (optional). Deleted after provisioning.';

REVOKE ALL ON public.educator_request_secrets FROM PUBLIC;

-- Anonymous direct inserts no longer allowed
DROP POLICY IF EXISTS "public_insert_educator_requests" ON public.educator_requests;
REVOKE INSERT ON public.educator_requests FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_educator_request(
  p_name           text,
  p_email          text,
  p_institution    text,
  p_role_title     text DEFAULT NULL,
  p_use_case       text DEFAULT NULL,
  p_message        text DEFAULT NULL,
  p_initial_password text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  pwd    text := nullif(trim(p_initial_password), '');
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF p_institution IS NULL OR btrim(p_institution) = '' THEN
    RAISE EXCEPTION 'Institution is required';
  END IF;
  IF pwd IS NOT NULL AND length(pwd) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters when provided';
  END IF;

  INSERT INTO public.educator_requests (name, email, institution, role_title, use_case, message, status)
  VALUES (
    btrim(p_name),
    lower(btrim(p_email)),
    btrim(p_institution),
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

REVOKE ALL ON FUNCTION public.submit_educator_request(text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_educator_request(text,text,text,text,text,text,text)
  TO anon, authenticated;
