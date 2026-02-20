-- RLS Yardımcı Fonksiyonu (Recursion'u önlemek için)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ADR Forms Politikalarını Güçlendir
DROP POLICY IF EXISTS "ADR Formlarını Görme Yetkisi" ON public.adr_forms;
DROP POLICY IF EXISTS "ADR Formu Ekleme" ON public.adr_forms;
DROP POLICY IF EXISTS "ADR Formu Güncelleme - Yönetici" ON public.adr_forms;
DROP POLICY IF EXISTS "ADR Formu Güncelleme - Personel" ON public.adr_forms;

-- Yeni Politikalar (Strict Tenant Access)
-- SADECE kendi şirketindeki verileri görür.
CREATE POLICY "ADR Formlarını Görme Yetkisi" ON public.adr_forms
FOR SELECT USING (
  public.is_system_admin() OR
  company_id = public.get_my_tenant_id()
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
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'company_manager' AND
  company_id = public.get_my_tenant_id()
);

-- Personel: Sadece kendi PENDING kayıtlarını güncelleyebilir
CREATE POLICY "ADR Formu Güncelleme - Personel" ON public.adr_forms
FOR UPDATE USING (
  auth.uid() = user_id AND status = 'pending'
);

-- Modül Tanımını Ekle / Güncelle
INSERT INTO public.modules (key, name, description, category)
VALUES ('adr', 'ADR Yönetimi', 'Tehlikeli madde süreç yönetimi', 'Operasyon')
ON CONFLICT (key) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- ÖNEMLİ: Otomatik Atamaları Temizle
-- Kullanıcı isteği üzerine modül otomatik olarak herkese açılmamalıdır.
-- Sistem yöneticisi admin panelinden ilgili şirkete manuel atama yapmalıdır.
-- Daha önce yanlışlıkla tüm şirketlere atandıysa, bu komut onları temizler.
DELETE FROM public.company_modules WHERE module_key = 'adr';

-- Not: Sistem yöneticisi artık /admin/companies sayfasından ilgili şirketin "Modüller" kısmına gidip "ADR Yönetimi"ni manuel eklemelidir.

-- Schema Reload
NOTIFY pgrst, 'reload schema';
