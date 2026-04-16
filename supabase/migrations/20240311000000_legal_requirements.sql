-- Önce eski tabloları silelim (Yeni migration gibi işlem görsün)
DROP TABLE IF EXISTS public.legal_tracking CASCADE;
DROP TABLE IF EXISTS public.legal_requirements CASCADE;
DROP TABLE IF EXISTS public.legal_articles CASCADE;
DROP TABLE IF EXISTS public.legal_regulations CASCADE;

-- Ana Yönetmelikler Tablosu
CREATE TABLE public.legal_regulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    gazette_date DATE,
    gazette_number TEXT,
    last_modification_date DATE,
    effective_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Api İzinleri (403 Hatasını engellemek için)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.legal_regulations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.legal_regulations TO service_role;

ALTER TABLE public.legal_regulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sistem_yonetici_legal_regulations" 
    ON public.legal_regulations
    FOR ALL
    TO authenticated
    USING (public.is_system_admin())
    WITH CHECK (public.is_system_admin());


-- Yönetmelik Maddeleri Tablosu
CREATE TABLE public.legal_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regulation_id UUID REFERENCES public.legal_regulations(id) ON DELETE CASCADE,
    article_number TEXT NOT NULL,
    provision TEXT,
    period TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Api İzinleri
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.legal_articles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.legal_articles TO service_role;

ALTER TABLE public.legal_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sistem_yonetici_legal_articles" 
    ON public.legal_articles
    FOR ALL
    TO authenticated
    USING (public.is_system_admin())
    WITH CHECK (public.is_system_admin());


-- Takip Çizelgesi Tablosu (Artık Maddeye Bağlı)
CREATE TABLE public.legal_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID REFERENCES public.legal_articles(id) ON DELETE CASCADE,
    location TEXT NOT NULL,
    current_status TEXT,
    is_applicable BOOLEAN DEFAULT true,
    is_compliant BOOLEAN,
    action_required TEXT,
    responsible_persons TEXT,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Api İzinleri
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.legal_tracking TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.legal_tracking TO service_role;

ALTER TABLE public.legal_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sistem_yonetici_legal_tracking" 
    ON public.legal_tracking
    FOR ALL
    TO authenticated
    USING (public.is_system_admin())
    WITH CHECK (public.is_system_admin());

-- Modül eklemesi
INSERT INTO public.modules (key, name, description, category) 
VALUES ('yasal_sartlar', 'Yasal Şartlar Takibi', 'Sistem genelinde yasal mevzuatların ve lokasyon bazlı takiplerin yapılması', 'Yönetim')
ON CONFLICT (key) DO NOTHING;
