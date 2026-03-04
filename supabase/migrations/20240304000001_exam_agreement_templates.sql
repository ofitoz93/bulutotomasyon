-- Migration: 20240304000001_exam_agreement_templates.sql
-- Description: Creates the exam agreement templates table for physical exams

CREATE TABLE public.exam_agreement_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    agreement_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at (reusing the existing function created in education_module_schema)
CREATE TRIGGER update_exam_agreement_templates_modtime BEFORE UPDATE ON public.exam_agreement_templates FOR EACH ROW EXECUTE PROCEDURE public.update_edu_modified_column();

-- Enable RLS
ALTER TABLE public.exam_agreement_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant users can view their exam agreement templates" 
    ON public.exam_agreement_templates FOR SELECT 
    USING (tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Tenant users can insert exam agreement templates" 
    ON public.exam_agreement_templates FOR INSERT 
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Tenant users can update their exam agreement templates" 
    ON public.exam_agreement_templates FOR UPDATE 
    USING (tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Tenant users can delete their exam agreement templates" 
    ON public.exam_agreement_templates FOR DELETE 
    USING (tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    ));
