-- =============================================
-- FIX COWORKER APPROVAL LOGIC
-- =============================================

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
    v_real_tc_no TEXT;
    v_real_sicil_no TEXT;
    v_coworker_id UUID;
    v_profile_exists BOOLEAN := FALSE;
BEGIN
    -- 1. İlgili iznin tenant'ını bul
    SELECT tenant_id INTO v_tenant_id FROM public.work_permits WHERE id = p_permit_id;
    IF v_tenant_id IS NULL THEN
        RETURN FALSE; -- İzin bulunamadı
    END IF;

    -- 2. Verilen tc_no veya sicil_no sistemde ({tenant_id}) kayıtlı gerçek bir profil mi?
    -- Hem tc_no hem sicil_no'yu bulalım
    SELECT tc_no, company_employee_no INTO v_real_tc_no, v_real_sicil_no
    FROM public.profiles 
    WHERE tenant_id = v_tenant_id 
    AND (
        (tc_no IS NOT NULL AND tc_no = p_tc_no) 
        OR 
        (company_employee_no IS NOT NULL AND company_employee_no = p_sicil_no)
    )
    LIMIT 1;

    IF FOUND THEN
        v_profile_exists := TRUE;
    END IF;

    IF NOT v_profile_exists THEN
        RAISE EXCEPTION 'Kimlik bilgileri sistemle eşleşmedi.';
    END IF;

    -- 3. Coworker kaydını bul ve onayla
    -- İzni oluşturan kişi, bu coworker için tc_no veya sicil_no girmiş olabilir.
    -- Bu girilen numara, approver profilinin GERÇEK tc_no'suna VEYA GERÇEK sicil_no'suna eşit olmalıdır.
    SELECT id INTO v_coworker_id 
    FROM public.work_permit_coworkers 
    WHERE permit_id = p_permit_id 
    AND (
        (tc_no IS NOT NULL AND (tc_no = v_real_tc_no OR tc_no = v_real_sicil_no))
        OR 
        (sicil_no IS NOT NULL AND (sicil_no = v_real_tc_no OR sicil_no = v_real_sicil_no))
    )
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
