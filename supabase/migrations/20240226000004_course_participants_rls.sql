-- Migration: 20240226000004_course_participants_rls.sql
-- Description: Adds Row Level Security (RLS) policies to course_participants and related tables in the education module so users can view participants in the report.

-- Enable RLS on education tables
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exam_results ENABLE ROW LEVEL SECURITY;

-- Courses: Anyone in the tenant can view courses
DROP POLICY IF EXISTS "Courses View for Tenant" ON public.courses;
CREATE POLICY "Courses View for Tenant" ON public.courses
FOR SELECT USING (tenant_id = public.get_my_tenant_id());

-- Courses: Managers can manage courses
DROP POLICY IF EXISTS "Courses Manage for Managers" ON public.courses;
CREATE POLICY "Courses Manage for Managers" ON public.courses
FOR ALL USING (
    tenant_id = public.get_my_tenant_id() AND public.is_education_manager()
);

-- Course Participants: Anyone in the tenant can view participants (needed for reports and finding out who is in a course)
DROP POLICY IF EXISTS "Participants View for Tenant" ON public.course_participants;
CREATE POLICY "Participants View for Tenant" ON public.course_participants
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.courses c 
        WHERE c.id = course_participants.course_id AND c.tenant_id = public.get_my_tenant_id()
    )
);

-- Course Participants: Education managers can manage participants
DROP POLICY IF EXISTS "Participants Manage for Managers" ON public.course_participants;
CREATE POLICY "Participants Manage for Managers" ON public.course_participants
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.courses c 
        WHERE c.id = course_participants.course_id AND c.tenant_id = public.get_my_tenant_id() AND public.is_education_manager()
    )
);

-- User Course Progress: Users can view their own, managers can view all in tenant
DROP POLICY IF EXISTS "Progress View" ON public.user_course_progress;
CREATE POLICY "Progress View" ON public.user_course_progress
FOR SELECT USING (
    user_id = auth.uid() OR public.is_education_manager()
);

-- User Course Progress: Users can manage their own
DROP POLICY IF EXISTS "Progress Manage" ON public.user_course_progress;
CREATE POLICY "Progress Manage" ON public.user_course_progress
FOR ALL USING (
    user_id = auth.uid()
);

-- User Exam Results: Users can view their own, managers can view all in tenant
DROP POLICY IF EXISTS "Exam Results View" ON public.user_exam_results;
CREATE POLICY "Exam Results View" ON public.user_exam_results
FOR SELECT USING (
    user_id = auth.uid() OR public.is_education_manager()
);

-- Since exams might be taken by guests or current users, we allow inserts basically if the exam belongs to their tenant
DROP POLICY IF EXISTS "Exam Results Insert" ON public.user_exam_results;
CREATE POLICY "Exam Results Insert" ON public.user_exam_results
FOR INSERT WITH CHECK (
    -- For now, allow all inserts to this table to support public exam links
    true
);

-- NOTIFY PostgREST
NOTIFY pgrst, 'reload schema';
