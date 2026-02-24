-- =============================================
-- İŞ İZNİ (WORK PERMITS) MODÜLÜ
-- =============================================

-- 1. Modülü Sisteme Ekle
INSERT INTO public.modules (key, name, description)
VALUES ('work_permits', 'İş İzni Modülü', 'Sahada çalışan personellerin iş izin formlarını doldurması, risklerin değerlendirilmesi ve onay süreçlerinin takibi.')
ON CONFLICT (key) DO NOTHING;

-- 2. Ana İş İzni Tablosu
CREATE TABLE IF NOT EXISTS public.work_permits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    
    -- Genel Bilgiler
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    department TEXT,
    company_name TEXT,
    work_date DATE NOT NULL,
    estimated_hours NUMERIC,
    project_id UUID REFERENCES public.action_projects(id),
    
    -- Risk Değerlendirmesi / Checklistler (JSONB array formatında tutacağız: ["Kapalı Alan", "Sıcak İş"] gibi)
    job_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    job_type_other TEXT,
    
    hazards JSONB NOT NULL DEFAULT '[]'::jsonb,
    hazard_other TEXT,
    
    ppe_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    ppe_other TEXT,
    
    precautions JSONB NOT NULL DEFAULT '[]'::jsonb,
    precaution_other TEXT,
    
    -- Onay Bilgileri & Statü
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    
    creator_tc_no TEXT, -- Taahhütnameyi imzalarken girilen TC/Sicil
    is_creator_approved BOOLEAN DEFAULT false,
    
    engineer_approved_by UUID REFERENCES public.profiles(id),
    engineer_approved_at TIMESTAMPTZ,
    
    isg_approved_by UUID REFERENCES public.profiles(id),
    isg_approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Beraber Çalışılacak Personeller Tablosu
CREATE TABLE IF NOT EXISTS public.work_permit_coworkers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permit_id UUID NOT NULL REFERENCES public.work_permits(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    location TEXT,
    sicil_no TEXT,
    tc_no TEXT,
    
    is_approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMPTZ
);

-- 4. RLS Etkinleştirme
ALTER TABLE public.work_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_permit_coworkers ENABLE ROW LEVEL SECURITY;

-- 5. Ana Tablo (work_permits) İçin RLS Politikaları

-- Herkes Kendi Şirketinin Verilerini Görebilir
CREATE POLICY "İş İzinlerini Görme" ON public.work_permits
    FOR SELECT USING (tenant_id = public.get_my_tenant_id());

-- Şirket Çalışanları İzin Oluşturabilir
CREATE POLICY "İş İzni Oluşturma" ON public.work_permits
    FOR INSERT WITH CHECK (tenant_id = public.get_my_tenant_id());

-- (Sadece Oluşturan Kişi veya Yöneticiler Güncelleyebilir)
CREATE POLICY "İş İznini Güncelleme" ON public.work_permits
    FOR UPDATE USING (
        tenant_id = public.get_my_tenant_id() AND 
        (
            auth.uid() = created_by 
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'company_manager')
            -- İleride mühendis / isg yetkileri de buraya eklenebilir
        )
    );

CREATE POLICY "İş İznini Silme" ON public.work_permits
    FOR DELETE USING (
        tenant_id = public.get_my_tenant_id() AND 
        (
            auth.uid() = created_by 
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'company_manager')
        )
    );

-- 6. Coworkers Tablosu İçin RLS Politikaları
CREATE POLICY "Beraber Çalışanları Görme" ON public.work_permit_coworkers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.work_permits WHERE id = permit_id AND tenant_id = public.get_my_tenant_id())
    );

CREATE POLICY "Beraber Çalışan Ekleme" ON public.work_permit_coworkers
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.work_permits WHERE id = permit_id AND tenant_id = public.get_my_tenant_id())
    );

CREATE POLICY "Beraber Çalışan Güncelleme" ON public.work_permit_coworkers
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.work_permits WHERE id = permit_id AND tenant_id = public.get_my_tenant_id())
    );

CREATE POLICY "Beraber Çalışan Silme" ON public.work_permit_coworkers
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.work_permits WHERE id = permit_id AND tenant_id = public.get_my_tenant_id())
    );

-- 7. Public (Dışarıdan) Coworker Onayı İçin Güvenli Fonksiyon
-- Bu fonksiyon, giriş yapmamış personel veya sahada telefondan onaylamak isteyen personel için 
-- tc/sicil numarasıyla güvenli bir eşleşme yapar ve onayı kaydeder.
CREATE OR REPLACE FUNCTION public.approve_work_permit_coworker(
    p_permit_id UUID,
    p_sicil_no TEXT,
    p_tc_no TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Güvenlik bypass'ı: Anonim kullanıcıların tabloyu update etmesine izin vermiyoruz, sadece bu fonksiyonla.
AS $$
DECLARE
    v_tenant_id UUID;
    v_profile_exists BOOLEAN;
    v_coworker_id UUID;
BEGIN
    -- 1. İlgili iznin tenant'ını bul
    SELECT tenant_id INTO v_tenant_id FROM public.work_permits WHERE id = p_permit_id;
    IF v_tenant_id IS NULL THEN
        RETURN FALSE; -- İzin bulunamadı
    END IF;

    -- 2. Verilen tc_no veya sicil_no sistemde ({tenant_id}) kayıtlı gerçek bir profil mi?
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE tenant_id = v_tenant_id 
        AND (
            (tc_no IS NOT NULL AND tc_no = p_tc_no) 
            OR 
            (company_employee_no IS NOT NULL AND company_employee_no = p_sicil_no)
        )
    ) INTO v_profile_exists;

    IF NOT v_profile_exists THEN
        RAISE EXCEPTION 'Kimlik bilgileri sistemle eşleşmedi.';
    END IF;

    -- 3. Coworker kaydını bul ve onayla
    -- İsimden ziyade, izne eklenmiş tc_no veya sicil_no ile eşleşen satırı bul
    SELECT id INTO v_coworker_id 
    FROM public.work_permit_coworkers 
    WHERE permit_id = p_permit_id 
    AND (tc_no = p_tc_no OR sicil_no = p_sicil_no)
    LIMIT 1;

    IF v_coworker_id IS NULL THEN
        RAISE EXCEPTION 'Bu iş iznine atanmış böyle bir personel bulunamadı.';
    END IF;

    -- 4. Güncellemeyi yap
    UPDATE public.work_permit_coworkers 
    SET is_approved = true, approved_at = now() 
    WHERE id = v_coworker_id;

    RETURN TRUE;
END;
$$;

NOTIFY pgrst, 'reload schema';
