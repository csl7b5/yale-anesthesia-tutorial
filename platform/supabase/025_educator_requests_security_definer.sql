-- Educator requests: admin RLS via auth.users (reliable email), not JWT claims.
-- Use this when 021/024 still leave the dashboard stuck or rows invisible (JWT often has no email claim).

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

REVOKE ALL ON FUNCTION public.is_master_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated;

DROP POLICY IF EXISTS "admin_select_educator_requests" ON public.educator_requests;
DROP POLICY IF EXISTS "admin_update_educator_requests" ON public.educator_requests;

CREATE POLICY "admin_select_educator_requests"
  ON public.educator_requests
  FOR SELECT
  TO authenticated
  USING (public.is_master_admin());

CREATE POLICY "admin_update_educator_requests"
  ON public.educator_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());
