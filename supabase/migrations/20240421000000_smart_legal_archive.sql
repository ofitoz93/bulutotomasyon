-- Akıllı Mevzuat Arşivi (PDF Destekli)

-- 1. Mevzuat Tablosu
CREATE TABLE public.pdf_regulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    gazette_date DATE,
    gazette_number TEXT,
    last_modification_date DATE,
    last_modification_number TEXT,
    is_visible BOOLEAN DEFAULT true,
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Maddeler Tablosu
CREATE TABLE public.pdf_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reg_id UUID REFERENCES public.pdf_regulations(id) ON DELETE CASCADE,
    article_number TEXT,
    content TEXT,
    admin_comment TEXT,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Api İzinleri
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pdf_regulations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pdf_regulations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pdf_articles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pdf_articles TO service_role;

-- RLS
ALTER TABLE public.pdf_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_articles ENABLE ROW LEVEL SECURITY;

-- Politikalar: pdf_regulations
CREATE POLICY "pdf_regulations_select" ON public.pdf_regulations
    FOR SELECT TO authenticated
    USING (
        tenant_id IS NULL OR 
        tenant_id = public.get_my_tenant_id() OR
        public.is_system_admin()
    );

CREATE POLICY "pdf_regulations_insert" ON public.pdf_regulations
    FOR INSERT TO authenticated
    WITH CHECK (public.is_system_admin() OR public.get_my_role() = 'company_manager');

CREATE POLICY "pdf_regulations_update" ON public.pdf_regulations
    FOR UPDATE TO authenticated
    USING (public.is_system_admin() OR public.get_my_role() = 'company_manager');

CREATE POLICY "pdf_regulations_delete" ON public.pdf_regulations
    FOR DELETE TO authenticated
    USING (public.is_system_admin() OR public.get_my_role() = 'company_manager');

-- Politikalar: pdf_articles
CREATE POLICY "pdf_articles_select" ON public.pdf_articles
    FOR SELECT TO authenticated
    USING (
        is_visible = true OR 
        public.is_system_admin() OR 
        public.get_my_role() = 'company_manager'
    );

CREATE POLICY "pdf_articles_all_admin" ON public.pdf_articles
    FOR ALL TO authenticated
    USING (public.is_system_admin() OR public.get_my_role() = 'company_manager')
    WITH CHECK (public.is_system_admin() OR public.get_my_role() = 'company_manager');

-- Modül Tanımı
INSERT INTO public.modules (key, name, description, category) 
VALUES ('akilli_mevzuat', 'Akıllı Mevzuat Arşivi', 'PDF formatındaki mevzuatların AI yardımıyla yönetilmesi', 'Yönetim')
ON CONFLICT (key) DO NOTHING;
