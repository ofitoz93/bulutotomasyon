-- 1. ADR Formları Ana Tablosu
CREATE TABLE IF NOT EXISTS public.adr_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    form_type TEXT NOT NULL, -- 'TANK-ALICI', 'AMBALAJ-ALICI', vb.
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    plate_no TEXT,
    driver_name TEXT,
    location_lat FLOAT,
    location_lng FLOAT,
    created_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id),
    notes TEXT
);

-- 2. Form Cevapları Tablosu (JSONB)
CREATE TABLE IF NOT EXISTS public.form_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.adr_forms(id) ON DELETE CASCADE,
    question_key TEXT NOT NULL,
    answer_value JSONB NOT NULL -- { "result": "Evet", "details": "..." }
);

-- 3. Form Medya Tablosu
CREATE TABLE IF NOT EXISTS public.form_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.adr_forms(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (Row Level Security) Etkinleştirme
ALTER TABLE public.adr_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_media ENABLE ROW LEVEL SECURITY;

-- POLİTİKALAR (Policies)

-- adr_forms
-- Okuma: Sistem admini hepsini, Şirket yöneticisi kendi şirketini, Personel kendi formunu veya şirketini (dashboard için gerekirse) görebilir.
CREATE POLICY "ADR Formlarını Görme Yetkisi" ON public.adr_forms
FOR SELECT USING (
    public.is_system_admin() OR
    (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = public.adr_forms.company_id)) -- tenant_id olarak düzeltildi
);

-- Ekleme: Authenticated kullanıcılar kendi şirketlerine ekleyebilir.
CREATE POLICY "ADR Formu Ekleme" ON public.adr_forms
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND -- Kendisi adına eklemeli
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tenant_id = public.adr_forms.company_id) -- Kendi şirketine eklemeli (tenant_id düzeltildi)
);

-- Güncelleme: (Onaylama vs.)
-- Yönetici her şeyi güncelleyebilir (Durum vs).
-- Personel SADECE kendi 'pending' formunu güncelleyebilir.
CREATE POLICY "ADR Formu Güncelleme - Yönetici" ON public.adr_forms
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'company_manager' 
        AND tenant_id = public.adr_forms.company_id
    )
);

CREATE POLICY "ADR Formu Güncelleme - Personel" ON public.adr_forms
FOR UPDATE USING (
    auth.uid() = user_id AND status = 'pending'
);

-- form_answers & form_media

CREATE POLICY "Cevapları Görme" ON public.form_answers
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.adr_forms f
        JOIN public.profiles p ON p.tenant_id = f.company_id
        WHERE f.id = public.form_answers.form_id AND p.id = auth.uid()
    )
    OR public.is_system_admin()
);

CREATE POLICY "Cevap Ekleme" ON public.form_answers
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.adr_forms f
        WHERE f.id = public.form_answers.form_id AND f.user_id = auth.uid()
    )
);

-- Medya için de benzer
CREATE POLICY "Medya Görme" ON public.form_media
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.adr_forms f
        JOIN public.profiles p ON p.tenant_id = f.company_id
        WHERE f.id = public.form_media.form_id AND p.id = auth.uid()
    )
    OR public.is_system_admin()
);

CREATE POLICY "Medya Ekleme" ON public.form_media
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.adr_forms f
        WHERE f.id = public.form_media.form_id AND f.user_id = auth.uid()
    )
);

-- Storage Buckets (Eğer yoksa oluşturmayı dener, yoksa manuel oluşturulmalı)
INSERT INTO storage.buckets (id, name, public)
VALUES ('adr-uploads', 'adr-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Politikaları
-- Önceki politikaları temizle (çakışma olmaması için)
DROP POLICY IF EXISTS "ADR Medya Ekleme" ON storage.objects;
DROP POLICY IF EXISTS "ADR Medya Görme" ON storage.objects;

CREATE POLICY "ADR Medya Ekleme" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'adr-uploads');
CREATE POLICY "ADR Medya Görme" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'adr-uploads');

-- Reload Schema
NOTIFY pgrst, 'reload schema';
