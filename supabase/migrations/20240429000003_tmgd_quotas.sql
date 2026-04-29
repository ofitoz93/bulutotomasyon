-- 1. Add doc_limit to tmgd_clients
ALTER TABLE public.tmgd_clients ADD COLUMN IF NOT EXISTS doc_limit INTEGER;

-- 2. Add alert settings to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tmgd_alert_email TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tmgd_quota_threshold INTEGER DEFAULT 20;

-- 3. Update the tmgd_public_create_doc RPC to handle auto-deletion
CREATE OR REPLACE FUNCTION public.tmgd_public_create_doc(
    p_client_id UUID,
    p_doc JSONB,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_doc_id UUID;
    v_item JSONB;
    v_limit INTEGER;
    v_total_docs INTEGER;
    v_docs_to_delete UUID[];
BEGIN
    -- Müşteri kotasını ve mevcut belge sayısını al
    SELECT doc_limit INTO v_limit FROM public.tmgd_clients WHERE id = p_client_id;
    SELECT count(*) INTO v_total_docs FROM public.tmgd_transport_docs WHERE client_id = p_client_id;
    
    -- 1. FİRMA LİMİTİ KONTROLÜ (Sadece yetkisiz/firma personeli girişi için)
    -- Firma kotası dolduğunda hata fırlatmıyoruz, firma oluşturmaya devam edebilir 
    -- ancak arayüzde sadece en yeni 'doc_limit' kadarını görecektir.
    -- (Eski versiyondaki bloke kaldırılarak FIFO mantığına geçildi)
    NULL;

    -- 2. HARD LIMIT (50): Herkes için geçerli olan sistem kapasite sınırı
    -- 50 evrak dolmuşsa en eski belgeleri sil (Sistemde en fazla 50 evrak tutulur)
    IF v_total_docs >= 50 THEN
        SELECT array_agg(id) INTO v_docs_to_delete
        FROM (
            SELECT id 
            FROM public.tmgd_transport_docs 
            WHERE client_id = p_client_id 
            ORDER BY created_at ASC 
            LIMIT (v_total_docs - 50 + 1)
        ) as subquery;

        IF v_docs_to_delete IS NOT NULL THEN
            DELETE FROM public.tmgd_transport_docs WHERE id = ANY(v_docs_to_delete);
        END IF;
    END IF;

    -- Ana belgeyi ekle
    INSERT INTO public.tmgd_transport_docs (
        client_id, tenant_id, status, date, waybill_no, order_no, transport_id_no,
        receiver_title, receiver_address, receiver_tel,
        carrier_company, driver_name, driver_plate,
        sender_name, sender_signature, driver_signature, total_1136_points,
        adr_checklist, is_multimodal, is_limited, is_env_hazardous, flow_type, form_type
    ) VALUES (
        p_client_id,
        (SELECT tenant_id FROM public.tmgd_clients WHERE id = p_client_id),
        p_doc->>'status',
        (p_doc->>'date')::date,
        p_doc->>'waybill_no',
        p_doc->>'order_no',
        p_doc->>'transport_id_no',
        p_doc->>'receiver_title',
        p_doc->>'receiver_address',
        p_doc->>'receiver_tel',
        p_doc->>'carrier_company',
        p_doc->>'driver_name',
        p_doc->>'driver_plate',
        p_doc->>'sender_name',
        p_doc->>'sender_signature',
        p_doc->>'driver_signature',
        (p_doc->>'total_1136_points')::numeric,
        (p_doc->>'adr_checklist')::jsonb,
        COALESCE((p_doc->>'is_multimodal')::boolean, false),
        COALESCE((p_doc->>'is_limited')::boolean, false),
        COALESCE((p_doc->>'is_env_hazardous')::boolean, false),
        p_doc->>'flow_type',
        p_doc->>'form_type'
    ) RETURNING id INTO v_doc_id;

    -- Öğeleri ekle
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.tmgd_transport_items (
            doc_id, client_id, tenant_id, product_id, 
            package_type, package_count, quantity, total_points
        ) VALUES (
            v_doc_id,
            p_client_id,
            (SELECT tenant_id FROM public.tmgd_clients WHERE id = p_client_id),
            (v_item->>'product_id')::uuid,
            v_item->>'package_type',
            (v_item->>'package_count')::integer,
            (v_item->>'quantity')::numeric,
            (v_item->>'total_points')::numeric
        );
    END LOOP;

    RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
