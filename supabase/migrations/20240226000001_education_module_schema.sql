-- Migration: 20240226000001_education_module_schema.sql
-- Description: Creates the foundation tables for the Education Module (Types, Classes, Courses, Materials, Exams, and User Progress)

-- 1. Tables for Education Settings (Types and Classes)
CREATE TABLE public.education_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.education_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    type_id UUID NOT NULL REFERENCES public.education_types(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tables for Courses and Materials
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.education_classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    passing_score NUMERIC DEFAULT 70.0,
    status TEXT DEFAULT 'draft', -- 'draft', 'published', 'archived'
    creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.course_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_num INTEGER NOT NULL DEFAULT 1,
    content_type TEXT NOT NULL, -- 'pdf', 'video'
    file_url TEXT,
    min_duration_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tables for Exams
CREATE TABLE public.course_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    exam_type TEXT NOT NULL DEFAULT 'final_test', -- 'pre_test', 'final_test', 'physical_only'
    time_limit_minutes INTEGER DEFAULT 0,
    agreement_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.exam_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.course_exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    image_url TEXT,
    order_num INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.exam_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    image_url TEXT,
    is_correct BOOLEAN DEFAULT false,
    order_num INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tables for Participants and Progress
CREATE TABLE public.course_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, user_id)
);

CREATE TABLE public.user_course_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.course_materials(id) ON DELETE CASCADE,
    time_spent_seconds INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, material_id)
);

CREATE TABLE public.user_exam_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.course_exams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL for external guests
    tc_no TEXT, -- For external guests finding physical exams
    full_name TEXT, -- For external guests
    score NUMERIC,
    status TEXT, -- 'passed', 'failed'
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    agreed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Helper Triggers to Auto-Update `updated_at` Column

-- We reuse the existing modtime trigger function if it exists, but create a safe wrapper just in case.
CREATE OR REPLACE FUNCTION update_edu_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_education_types_modtime BEFORE UPDATE ON public.education_types FOR EACH ROW EXECUTE PROCEDURE update_edu_modified_column();
CREATE TRIGGER update_education_classes_modtime BEFORE UPDATE ON public.education_classes FOR EACH ROW EXECUTE PROCEDURE update_edu_modified_column();
CREATE TRIGGER update_courses_modtime BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE PROCEDURE update_edu_modified_column();
CREATE TRIGGER update_course_materials_modtime BEFORE UPDATE ON public.course_materials FOR EACH ROW EXECUTE PROCEDURE update_edu_modified_column();
CREATE TRIGGER update_course_exams_modtime BEFORE UPDATE ON public.course_exams FOR EACH ROW EXECUTE PROCEDURE update_edu_modified_column();
CREATE TRIGGER update_exam_questions_modtime BEFORE UPDATE ON public.exam_questions FOR EACH ROW EXECUTE PROCEDURE update_edu_modified_column();
CREATE TRIGGER update_exam_answers_modtime BEFORE UPDATE ON public.exam_answers FOR EACH ROW EXECUTE PROCEDURE update_edu_modified_column();
CREATE TRIGGER update_user_course_progress_modtime BEFORE UPDATE ON public.user_course_progress FOR EACH ROW EXECUTE PROCEDURE update_edu_modified_column();

-- Optional: Enable RLS later when we write the queries correctly, 
-- or we will manage data via SECURITY DEFINER RPCs where needed for Public/Offline interfaces.
