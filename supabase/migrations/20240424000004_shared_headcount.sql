-- Shared Headcount Management for Resource Modules
CREATE TABLE IF NOT EXISTS public.monthly_headcounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL,
    headcount INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, period_month, period_year)
);

-- RLS
ALTER TABLE public.monthly_headcounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their company's headcounts" ON public.monthly_headcounts
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Add a module key for the unified view if needed, but we'll use the existing ones or a new one.
INSERT INTO public.modules (key, name, description)
VALUES ('kaynak_yonetimi', 'Kaynak ve Verimlilik Yönetimi', 'Su, Enerji ve Çalışan Sayısı bazlı verimlilik takip merkezi.')
ON CONFLICT (key) DO NOTHING;
