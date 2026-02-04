-- Add the first admin user (this bypasses RLS since it's a migration)
INSERT INTO public.user_roles (user_id, role) 
VALUES ('7c9ea21d-aa80-439b-8eb1-27d6ab973b50', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;