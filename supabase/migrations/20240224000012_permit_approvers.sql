-- =============================================
-- İŞ İZNİ ONAY MERCİLERİ (APPROVERS) TABLOSU
-- =============================================

CREATE TABLE IF NOT EXISTS public.work_permit_approvers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_type TEXT NOT NULL CHECK (role_type IN ('engineer', 'isg')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, user_id, role_type)
);

-- RLS Etkinleştir
ALTER TABLE public.work_permit_approvers ENABLE ROW LEVEL SECURITY;

-- Politikalar
-- 1. Herkes kendi şirketindeki onaycıları görebilir
CREATE POLICY "Onaycıları Görme" ON public.work_permit_approvers
    FOR SELECT USING (tenant_id = public.get_my_tenant_id());

-- 2. Şirket Yöneticileri ekleme yapabilir
CREATE POLICY "Onaycı Ekleme" ON public.work_permit_approvers
    FOR INSERT WITH CHECK (
        tenant_id = public.get_my_tenant_id() AND 
        public.get_my_role() = 'company_manager'
    );

-- 3. Şirket Yöneticileri silebilir
CREATE POLICY "Onaycı Silme" ON public.work_permit_approvers
    FOR DELETE USING (
        tenant_id = public.get_my_tenant_id() AND 
        public.get_my_role() = 'company_manager'
    );

-- =============================================
-- ANA TABLO (work_permits) RLS GÜNCELLEMESİ
-- =============================================
-- Not: Onaycılar (Approvers) tablosuna eklenen kişilerin
-- iş izinlerini görebilmesi ve GÜNCELLEYEBİLMESİ (onay verebilmesi) gerekir.
-- Önceki UPDATE politikasını düşürüp yenisini ekleyelim.

DROP POLICY IF EXISTS "İş İznini Güncelleme" ON public.work_permits;

CREATE POLICY "İş İznini Güncelleme" ON public.work_permits
    FOR UPDATE USING (
        tenant_id = public.get_my_tenant_id() AND 
        (
            -- İşlemi yapan kişi izin sahibi
            auth.uid() = created_by 
            OR 
            -- Veya şirket yöneticisi
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'company_manager')
            OR
            -- Veya bu modülde bir onaycı yetkisine sahipse (Mühendis / İSG)
            EXISTS (SELECT 1 FROM public.work_permit_approvers WHERE user_id = auth.uid() AND tenant_id = public.get_my_tenant_id())
        )
    );

-- NOTIFY PostgREST
NOTIFY pgrst, 'reload schema';
