-- Migration: 20240304000002_class_question_templates.sql
-- Description: Creates the class_question_templates and class_answer_templates tables for managing question banks per education class.

CREATE TABLE public.class_question_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.education_classes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    image_url TEXT,
    order_num INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.class_answer_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_template_id UUID NOT NULL REFERENCES public.class_question_templates(id) ON DELETE CASCADE,
    answer_text TEXT,
    image_url TEXT,
    is_correct BOOLEAN DEFAULT false,
    order_num INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers for updated_at (reusing the existing function created in education_module_schema)
CREATE TRIGGER update_class_question_templates_modtime BEFORE UPDATE ON public.class_question_templates FOR EACH ROW EXECUTE PROCEDURE public.update_edu_modified_column();
CREATE TRIGGER update_class_answer_templates_modtime BEFORE UPDATE ON public.class_answer_templates FOR EACH ROW EXECUTE PROCEDURE public.update_edu_modified_column();

-- Enable RLS
ALTER TABLE public.class_question_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_answer_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for class_question_templates
CREATE POLICY "Tenant users can view their class question templates" 
    ON public.class_question_templates FOR SELECT 
    USING (class_id IN (
        SELECT id FROM public.education_classes WHERE tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Tenant users can insert class question templates" 
    ON public.class_question_templates FOR INSERT 
    WITH CHECK (class_id IN (
        SELECT id FROM public.education_classes WHERE tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Tenant users can update their class question templates" 
    ON public.class_question_templates FOR UPDATE 
    USING (class_id IN (
        SELECT id FROM public.education_classes WHERE tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Tenant users can delete their class question templates" 
    ON public.class_question_templates FOR DELETE 
    USING (class_id IN (
        SELECT id FROM public.education_classes WHERE tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
        )
    ));

-- RLS Policies for class_answer_templates
CREATE POLICY "Tenant users can view their class answer templates" 
    ON public.class_answer_templates FOR SELECT 
    USING (question_template_id IN (
        SELECT q.id FROM public.class_question_templates q
        JOIN public.education_classes c ON q.class_id = c.id
        WHERE c.tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Tenant users can insert class answer templates" 
    ON public.class_answer_templates FOR INSERT 
    WITH CHECK (question_template_id IN (
        SELECT q.id FROM public.class_question_templates q
        JOIN public.education_classes c ON q.class_id = c.id
        WHERE c.tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Tenant users can update their class answer templates" 
    ON public.class_answer_templates FOR UPDATE 
    USING (question_template_id IN (
        SELECT q.id FROM public.class_question_templates q
        JOIN public.education_classes c ON q.class_id = c.id
        WHERE c.tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Tenant users can delete their class answer templates" 
    ON public.class_answer_templates FOR DELETE 
    USING (question_template_id IN (
        SELECT q.id FROM public.class_question_templates q
        JOIN public.education_classes c ON q.class_id = c.id
        WHERE c.tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
        )
    ));
