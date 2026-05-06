-- ── 021: Educator account requests ──────────────────────────────────────────
-- Anyone (including unauthenticated) can submit a request.
-- Only the admin account (firenixx2k@gmail.com) can read or update requests.

CREATE TABLE IF NOT EXISTS public.educator_requests (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text        NOT NULL,
  email       text        NOT NULL,
  institution text        NOT NULL,
  role_title  text,
  use_case    text,
  message     text,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.educator_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or authenticated) can insert a new request
CREATE POLICY "public_insert_educator_requests"
  ON public.educator_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only the master admin can read requests
CREATE POLICY "admin_select_educator_requests"
  ON public.educator_requests
  FOR SELECT
  TO authenticated
  USING (auth.email() = 'firenixx2k@gmail.com');

-- Only the master admin can update status / notes
CREATE POLICY "admin_update_educator_requests"
  ON public.educator_requests
  FOR UPDATE
  TO authenticated
  USING  (auth.email() = 'firenixx2k@gmail.com')
  WITH CHECK (auth.email() = 'firenixx2k@gmail.com');
