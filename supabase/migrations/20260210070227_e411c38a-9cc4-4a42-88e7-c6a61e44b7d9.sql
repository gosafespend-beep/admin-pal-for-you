
-- Fix the overly permissive insert policy on admin_audit_log
DROP POLICY "Service role can insert audit log" ON public.admin_audit_log;

CREATE POLICY "Admins can insert audit log"
  ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
