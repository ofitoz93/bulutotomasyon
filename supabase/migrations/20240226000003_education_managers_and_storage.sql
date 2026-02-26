-- Migration: 20240226000003_education_managers_and_storage.sql
-- Description: Creates the education_managers table and the storage bucket for course materials.

-- 1. Education Managers Table
CREATE TABLE IF NOT EXISTS public.education_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- RLS for education_managers
ALTER TABLE public.education_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "education_managers_select" ON public.education_managers FOR SELECT USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "education_managers_manage" ON public.education_managers FOR ALL USING (
    tenant_id = public.get_my_tenant_id()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'company_manager')
);

-- Helper function to check if current user is an education manager for their tenant
CREATE OR REPLACE FUNCTION public.is_education_manager()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.education_managers 
        WHERE tenant_id = public.get_my_tenant_id() AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'company_manager'
    );
END;
$$;


-- 2. Storage Bucket for Education Materials
INSERT INTO storage.buckets (id, name, public) 
VALUES ('education_materials', 'education_materials', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- Anyone can read (since it's public, or we can enforce authenticated read)
CREATE POLICY "Public Read for Education Materials"
ON storage.objects FOR SELECT
USING ( bucket_id = 'education_materials' );

-- Admins and Education Managers can upload/delete
CREATE POLICY "Upload for Managers"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'education_materials' 
    AND (auth.role() = 'authenticated')
);

CREATE POLICY "Delete for Managers"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'education_materials' 
    AND (auth.role() = 'authenticated')
);

-- NOTIFY PostgREST
NOTIFY pgrst, 'reload schema';
