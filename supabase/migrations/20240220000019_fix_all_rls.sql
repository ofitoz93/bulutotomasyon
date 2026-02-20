-- RLS Yardımcı Fonksiyonunu Yarat/Düzelt (SECURITY DEFINER = RLS Bypass)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid());
END;
$$;

-- ADR FORMS: Mevcut RLS Politikalarını Temizle
DROP POLICY IF EXISTS "ADR Formlarını Görme Yetkisi" ON public.adr_forms;
DROP POLICY IF EXISTS "ADR Formu Ekleme" ON public.adr_forms;
DROP POLICY IF EXISTS "ADR Formu Güncelleme - Yönetici" ON public.adr_forms;
DROP POLICY IF EXISTS "ADR Formu Güncelleme - Personel" ON public.adr_forms;

-- ADR FORMS: Yeni Politikalar (Strict Access)
-- Herkes (Authenticated) YALNIZCA KENDİ ŞİRKETİNDEKİ formları görebilir.
CREATE POLICY "ADR Formlarını Görme Yetkisi" ON public.adr_forms
FOR SELECT USING (
    (public.is_system_admin()) OR
    (company_id = public.get_my_tenant_id())
);

-- Ekleme: Kullanıcı kendi şirketine ekleyebilir.
CREATE POLICY "ADR Formu Ekleme" ON public.adr_forms
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    company_id = public.get_my_tenant_id()
);

-- Güncelleme:
-- Yönetici: Kendi şirketindeki kayıtları güncelleyebilir
CREATE POLICY "ADR Formu Güncelleme - Yönetici" ON public.adr_forms
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('company_manager', 'system_admin')) AND
    company_id = public.get_my_tenant_id()
);

-- Personel: Sadece kendi PENDING kayıtlarını güncelleyebilir
CREATE POLICY "ADR Formu Güncelleme - Personel" ON public.adr_forms
FOR UPDATE USING (
    auth.uid() = user_id AND status = 'pending'
);

-- FORM CEVAPLARI: RLS Politikalarını Temizle
DROP POLICY IF EXISTS "Cevapları Görme" ON public.form_answers;
DROP POLICY IF EXISTS "Cevap Ekleme" ON public.form_answers;

-- FORM CEVAPLARI: Yeni Politikalar (get_my_tenant_id ile güvenli JOIN)
CREATE POLICY "Cevapları Görme" ON public.form_answers
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.adr_forms f
        WHERE f.id = form_answers.form_id
        AND (
            public.is_system_admin() OR
            f.company_id = public.get_my_tenant_id()
        )
    )
);

CREATE POLICY "Cevap Ekleme" ON public.form_answers
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.adr_forms f
        WHERE f.id = form_answers.form_id
        AND f.user_id = auth.uid()
    )
);

-- FORM MEDYA: RLS Politikalarını Temizle
DROP POLICY IF EXISTS "Medya Görme" ON public.form_media;
DROP POLICY IF EXISTS "Medya Ekleme" ON public.form_media;

-- FORM MEDYA: Yeni Politikalar
CREATE POLICY "Medya Görme" ON public.form_media
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.adr_forms f
        WHERE f.id = form_media.form_id
        AND (
            public.is_system_admin() OR
            f.company_id = public.get_my_tenant_id()
        )
    )
);

CREATE POLICY "Medya Ekleme" ON public.form_media
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.adr_forms f
        WHERE f.id = form_media.form_id
        AND f.user_id = auth.uid()
    )
);

-- Schema Reload
NOTIFY pgrst, 'reload schema';
