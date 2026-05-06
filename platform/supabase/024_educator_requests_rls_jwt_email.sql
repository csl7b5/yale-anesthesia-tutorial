-- Fix educator_requests admin RLS: use JWT email claim (auth.email() is not available on all Postgres/Supabase versions).

DROP POLICY IF EXISTS "admin_select_educator_requests" ON public.educator_requests;
DROP POLICY IF EXISTS "admin_update_educator_requests" ON public.educator_requests;

CREATE POLICY "admin_select_educator_requests"
  ON public.educator_requests
  FOR SELECT
  TO authenticated
  USING (lower(coalesce((auth.jwt() ->> 'email')::text, '')) = 'firenixx2k@gmail.com');

CREATE POLICY "admin_update_educator_requests"
  ON public.educator_requests
  FOR UPDATE
  TO authenticated
  USING  (lower(coalesce((auth.jwt() ->> 'email')::text, '')) = 'firenixx2k@gmail.com')
  WITH CHECK (lower(coalesce((auth.jwt() ->> 'email')::text, '')) = 'firenixx2k@gmail.com');
