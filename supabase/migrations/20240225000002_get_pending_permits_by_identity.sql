-- =============================================
-- QUICK PERMIT: GET PENDING PERMITS BY IDENTITY
-- =============================================

DROP FUNCTION IF EXISTS public.get_pending_permits_by_identity(TEXT);

CREATE OR REPLACE FUNCTION public.get_pending_permits_by_identity(
    p_identity TEXT
)
RETURNS TABLE (
    permit_id UUID,
    work_date DATE,
    company_name TEXT,
    department TEXT,
    estimated_hours NUMERIC,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER -- Güvenlik bypass'ı: Anonim kullanıcıların tabloyu okumasına izin vermiyoruz, sadece bu fonksiyonla.
SET search_path = public
AS $$
DECLARE
    v_real_tc_no TEXT;
    v_real_sicil_no TEXT;
    v_tenant_id UUID;
BEGIN
    -- 1. Verilen p_identity ile auth olmadan bir tenant bulmamız zor.
    -- Bu senaryoda coworker tablosundan direkt tc_no veya sicil_no ile bekleyen izinleri bulacağız.
    -- ÖNEMLİ: Hızlı onay ekranı login olmadan çalışıyor! O yüzden tc/sicil bazlı genel bir arama yapacağız.
    
    RETURN QUERY
    SELECT 
        wp.id as permit_id,
        wp.work_date,
        wp.company_name,
        wp.department,
        wp.estimated_hours,
        wp.status::TEXT
    FROM public.work_permit_coworkers wpc
    JOIN public.work_permits wp ON wp.id = wpc.permit_id
    WHERE 
        wpc.is_approved = false 
        -- İsterseniz wp.status = 'approved' filtresi koyabilirsiniz. Şu an açık bırakıyoruz:
        AND (
            (wpc.tc_no IS NOT NULL AND wpc.tc_no = p_identity)
            OR 
            (wpc.sicil_no IS NOT NULL AND wpc.sicil_no = p_identity)
        );
END;
$$;
