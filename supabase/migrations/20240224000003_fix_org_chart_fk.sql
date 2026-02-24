-- 20240224000003_fix_org_chart_fk.sql
-- Drop the existing foreign key constraint that references auth.users
ALTER TABLE public.department_members
  DROP CONSTRAINT IF EXISTS department_members_user_id_fkey;

-- Add a new foreign key constraint that references public.profiles
ALTER TABLE public.department_members
  ADD CONSTRAINT department_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
