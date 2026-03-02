-- =====================================================
-- İSG MERKEZİ MODÜLÜ
-- =====================================================

-- 1. Modülü Sisteme Kaydet
INSERT INTO public.modules (key, name, description)
VALUES (
    'isg_merkezi',
    'İSG Merkezi',
    '6331 İSG Kanunu kapsamında kaza takibi, risk değerlendirme, denetim ve ölçüm yönetimi.'
)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 2. İŞ KAZASI VE RAMAK KALA OLAY KAYDI
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ohs_accidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    tracking_no TEXT,
    type TEXT NOT NULL DEFAULT 'kaza', -- 'kaza' veya 'ramak_kala'
    accident_date DATE NOT NULL,
    accident_time TIME,
    location TEXT,
    department TEXT,
    injured_person_name TEXT,
    injured_person_id UUID REFERENCES public.profiles(id),
    injury_type TEXT,           -- Yaralanma türü (kesik, kırık, vb.)
    body_part TEXT,             -- Etkilenen vücut bölümü
    severity TEXT DEFAULT 'hafif', -- 'hafif', 'orta', 'agir', 'olumlu'
    lost_workdays INT DEFAULT 0,
    description TEXT NOT NULL,
    immediate_cause TEXT,       -- Anlık neden
    root_cause TEXT,            -- Kök neden
    corrective_action TEXT,     -- Alınan önlem
    witness_names TEXT,
    status TEXT DEFAULT 'acik', -- 'acik', 'inceleniyor', 'kapali'
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Otomatik takip numarası için sequence tablosu
CREATE TABLE IF NOT EXISTS public.ohs_accident_sequences (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    last_val INT DEFAULT 0
);

-- Trigger: Otomatik kaza no
CREATE OR REPLACE FUNCTION generate_ohs_accident_no()
RETURNS TRIGGER AS $$
DECLARE
    seq_val INT;
    year_str TEXT;
    prefix TEXT;
BEGIN
    INSERT INTO public.ohs_accident_sequences (company_id, last_val)
    VALUES (NEW.company_id, 0) ON CONFLICT (company_id) DO NOTHING;

    UPDATE public.ohs_accident_sequences
    SET last_val = last_val + 1
    WHERE company_id = NEW.company_id
    RETURNING last_val INTO seq_val;

    year_str := TO_CHAR(now(), 'YYYY');
    prefix := CASE WHEN NEW.type = 'ramak_kala' THEN 'RK' ELSE 'KZ' END;
    NEW.tracking_no := prefix || '-' || year_str || '-' || LPAD(seq_val::text, 3, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ohs_accident_no_trigger ON public.ohs_accidents;
CREATE TRIGGER ohs_accident_no_trigger
BEFORE INSERT ON public.ohs_accidents
FOR EACH ROW EXECUTE FUNCTION generate_ohs_accident_no();

-- =====================================================
-- 3. İSG DENETİM TAKİBİ
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ohs_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    tracking_no TEXT,
    audit_type TEXT NOT NULL DEFAULT 'ic', -- 'ic' (iç), 'dis' (dış/resmi)
    audit_date DATE NOT NULL,
    auditor_name TEXT NOT NULL,
    auditor_institution TEXT,   -- Kurum (SGK, İş Güvenliği Uzmanı, vb.)
    scope TEXT,                 -- Denetim kapsamı/alanı
    findings TEXT,              -- Tespitler
    nonconformities TEXT,       -- Uygunsuzluklar
    recommendations TEXT,       -- Öneriler
    corrective_actions TEXT,    -- DÖF bağlantısı veya açıklama
    deadline DATE,              -- Kapanış tarihi
    status TEXT DEFAULT 'acik', -- 'acik', 'takipte', 'kapali'
    result TEXT DEFAULT 'uygun', -- 'uygun', 'kosullu_uygun', 'uygunsuz'
    file_url TEXT,              -- Denetim raporu dosyası
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 4. RİSK DEĞERLENDİRME RAPORLARI
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ohs_risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    assessment_date DATE NOT NULL,
    review_date DATE,           -- Bir sonraki güncelleme tarihi
    department TEXT,
    assessor_name TEXT NOT NULL,
    risk_count INT DEFAULT 0,
    high_risk_count INT DEFAULT 0,
    medium_risk_count INT DEFAULT 0,
    low_risk_count INT DEFAULT 0,
    status TEXT DEFAULT 'aktif', -- 'aktif', 'revizyon', 'arsiv'
    file_url TEXT,              -- PDF raporu
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 5. PERİYODİK ÖLÇÜM KAYITLARI
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ohs_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    measurement_type TEXT NOT NULL, -- 'gurultu', 'toz', 'aydinlatma', 'titresim', 'kimyasal', 'diger'
    measurement_date DATE NOT NULL,
    location TEXT NOT NULL,
    measured_value NUMERIC,
    unit TEXT,                  -- dB, mg/m³, lux, vb.
    limit_value NUMERIC,        -- Yasal sınır değeri
    result TEXT DEFAULT 'uygun', -- 'uygun', 'uygunsuz'
    measuring_company TEXT,     -- Ölçümü yapan firma
    certificate_no TEXT,        -- Ölçüm belgesi no
    next_measurement_date DATE, -- Sonraki ölçüm tarihi
    file_url TEXT,              -- Ölçüm raporu dosyası
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 6. RLS POLİTİKALARI
-- =====================================================
ALTER TABLE public.ohs_accidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ohs_accident_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ohs_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ohs_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ohs_measurements ENABLE ROW LEVEL SECURITY;

-- Kazalar
CREATE POLICY "ohs_accidents_select" ON public.ohs_accidents FOR SELECT USING (company_id = public.get_my_tenant_id());
CREATE POLICY "ohs_accidents_insert" ON public.ohs_accidents FOR INSERT WITH CHECK (company_id = public.get_my_tenant_id());
CREATE POLICY "ohs_accidents_update" ON public.ohs_accidents FOR UPDATE USING (company_id = public.get_my_tenant_id());
CREATE POLICY "ohs_accidents_delete" ON public.ohs_accidents FOR DELETE USING (company_id = public.get_my_tenant_id());

-- Sequence
CREATE POLICY "ohs_seq_all" ON public.ohs_accident_sequences FOR ALL USING (company_id = public.get_my_tenant_id());

-- Denetimler
CREATE POLICY "ohs_audits_select" ON public.ohs_audits FOR SELECT USING (company_id = public.get_my_tenant_id());
CREATE POLICY "ohs_audits_insert" ON public.ohs_audits FOR INSERT WITH CHECK (company_id = public.get_my_tenant_id());
CREATE POLICY "ohs_audits_update" ON public.ohs_audits FOR UPDATE USING (company_id = public.get_my_tenant_id());
CREATE POLICY "ohs_audits_delete" ON public.ohs_audits FOR DELETE USING (company_id = public.get_my_tenant_id());

-- Risk Değerlendirmeleri
CREATE POLICY "ohs_risks_select" ON public.ohs_risk_assessments FOR SELECT USING (company_id = public.get_my_tenant_id());
CREATE POLICY "ohs_risks_insert" ON public.ohs_risk_assessments FOR INSERT WITH CHECK (company_id = public.get_my_tenant_id());
CREATE POLICY "ohs_risks_update" ON public.ohs_risk_assessments FOR UPDATE USING (company_id = public.get_my_tenant_id());
CREATE POLICY "ohs_risks_delete" ON public.ohs_risk_assessments FOR DELETE USING (company_id = public.get_my_tenant_id());

-- Ölçümler
CREATE POLICY "ohs_meas_select" ON public.ohs_measurements FOR SELECT USING (company_id = public.get_my_tenant_id());
CREATE POLICY "ohs_meas_insert" ON public.ohs_measurements FOR INSERT WITH CHECK (company_id = public.get_my_tenant_id());
CREATE POLICY "ohs_meas_update" ON public.ohs_measurements FOR UPDATE USING (company_id = public.get_my_tenant_id());
CREATE POLICY "ohs_meas_delete" ON public.ohs_measurements FOR DELETE USING (company_id = public.get_my_tenant_id());

-- =====================================================
-- 7. STORAGE BUCKET
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ohs-documents', 'ohs-documents', true, 20971520) -- 20MB
ON CONFLICT (id) DO UPDATE SET file_size_limit = 20971520;

DROP POLICY IF EXISTS "ohs_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "ohs_docs_select" ON storage.objects;

CREATE POLICY "ohs_docs_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ohs-documents');
CREATE POLICY "ohs_docs_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ohs-documents');
CREATE POLICY "ohs_docs_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ohs-documents');

NOTIFY pgrst, 'reload schema';
