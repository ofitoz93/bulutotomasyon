-- =====================================================
-- PERSONEL TAKİP MODÜLÜ
-- =====================================================

-- 1. Modülü Sisteme Kaydet
INSERT INTO public.modules (key, name, description, category)
VALUES (
    'personel_takip',
    'Personel Takip',
    'Çalışanların özlük bilgileri, sağlık kayıtları, KKD zimmetleri ve eğitim durumlarının merkezi yönetimi.',
    'İnsan Kaynakları'
)
ON CONFLICT (key) DO UPDATE SET category = 'İnsan Kaynakları';

-- 2. Profiles Tablosunu Genişlet (Eksik Sütunlar)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subcontractor_id UUID REFERENCES public.subcontractors(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS position TEXT,
ADD COLUMN IF NOT EXISTS blood_group TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS hiring_date DATE,
ADD COLUMN IF NOT EXISTS leaving_date DATE,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- 3. Sağlık ve Muayene Kayıtları
CREATE TABLE IF NOT EXISTS public.personnel_health_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL DEFAULT 'periyodik_muayene', -- 'ise_giris', 'periyodik_muayene', 'is_donusu', 'diger'
    exam_date DATE NOT NULL,
    next_exam_date DATE,
    doctor_name TEXT,
    result TEXT DEFAULT 'uygun', -- 'uygun', 'uygunsuz', 'kisitli_uygun'
    findings TEXT,
    recommendations TEXT,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id)
);

-- 4. KKD (Kişisel Koruyucu Donanım) Tanımları
CREATE TABLE IF NOT EXISTS public.ppe_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT, -- 'Bas', 'Goz', 'Kulak', 'Solunum', 'El', 'Ayak', 'Vucut', 'Diger'
    renewal_period_months INT DEFAULT 0, -- 0 ise yenileme gerekmez
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. KKD Zimmet Kayıtları
CREATE TABLE IF NOT EXISTS public.ppe_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ppe_type_id UUID NOT NULL REFERENCES public.ppe_types(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_renewal_date DATE,
    actual_renewal_date DATE,
    size TEXT, -- Ayakkabı no, Beden vb.
    status TEXT DEFAULT 'zimmetli', -- 'zimmetli', 'iade', 'kayip', 'eskidi'
    notes TEXT,
    form_url TEXT, -- İmzalı tutanak dosyası
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id)
);

-- 6. RLS POLİTİKALARI
ALTER TABLE public.personnel_health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ppe_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ppe_assignments ENABLE ROW LEVEL SECURITY;

-- Sağlık Kayıtları
CREATE POLICY "Health records select" ON public.personnel_health_records FOR SELECT USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "Health records insert" ON public.personnel_health_records FOR INSERT WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY "Health records update" ON public.personnel_health_records FOR UPDATE USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "Health records delete" ON public.personnel_health_records FOR DELETE USING (tenant_id = public.get_my_tenant_id());

-- KKD Tipleri
CREATE POLICY "PPE types select" ON public.ppe_types FOR SELECT USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "PPE types manage" ON public.ppe_types FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- KKD Zimmetleri
CREATE POLICY "PPE assignments select" ON public.ppe_assignments FOR SELECT USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "PPE assignments manage" ON public.ppe_assignments FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- 7. STORAGE BUCKET (Eğer yoksa) - OHS Documents bucket'ını personel için de kullanabiliriz 
-- ama ayrı bir tane oluşturmak daha temiz.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('personnel-documents', 'personnel-documents', false, 10485760) -- 10MB, private
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Personnel docs access" ON storage.objects FOR ALL TO authenticated 
USING (bucket_id = 'personnel-documents')
WITH CHECK (bucket_id = 'personnel-documents');

NOTIFY pgrst, 'reload schema';
