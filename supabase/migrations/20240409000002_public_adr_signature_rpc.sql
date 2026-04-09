-- Public ADR RPC fonksiyonunu driver_signature parametresiyle güncelle

CREATE OR REPLACE FUNCTION public.submit_public_adr_form(
    p_identity_no TEXT,
    p_form_type TEXT,
    p_plate_no TEXT,
    p_driver_name TEXT,
    p_location_lat FLOAT,
    p_location_lng FLOAT,
    p_notes TEXT,
    p_form_answers JSONB,
    p_form_media JSONB DEFAULT '[]'::jsonb,
    p_driver_signature TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_form_id UUID;
    v_answer_key TEXT;
    v_answer_value JSONB;
    v_media_url TEXT;
BEGIN
    -- 1. Find the employee (user_id) and their company (tenant_id)
    SELECT id, tenant_id INTO v_user_id, v_tenant_id
    FROM public.profiles
    WHERE tc_no = p_identity_no OR company_employee_no = p_identity_no
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Bu Kimlik veya Sicil Numarasına ait bir personel kaydı bulunamadı.';
    END IF;

    -- 2. Insert the main ADR form record (with driver_signature)
    INSERT INTO public.adr_forms (
        company_id,
        user_id,
        form_type,
        status,
        plate_no,
        driver_name,
        driver_signature,
        location_lat,
        location_lng,
        notes
    ) VALUES (
        v_tenant_id,
        v_user_id,
        p_form_type,
        'pending',
        p_plate_no,
        p_driver_name,
        p_driver_signature,
        p_location_lat,
        p_location_lng,
        p_notes
    ) RETURNING id INTO v_form_id;

    -- 3. Insert form answers
    IF p_form_answers IS NOT NULL AND jsonb_typeof(p_form_answers) = 'object' THEN
        FOR v_answer_key, v_answer_value IN SELECT * FROM jsonb_each(p_form_answers)
        LOOP
            INSERT INTO public.form_answers (
                form_id,
                question_key,
                answer_value
            ) VALUES (
                v_form_id,
                v_answer_key,
                v_answer_value
            );
        END LOOP;
    END IF;

    -- 4. Insert form media
    IF p_form_media IS NOT NULL AND jsonb_typeof(p_form_media) = 'array' THEN
        FOR v_media_url IN SELECT jsonb_array_elements_text(p_form_media)
        LOOP
            IF v_media_url IS NOT NULL AND v_media_url != '' THEN
                INSERT INTO public.form_media (
                    form_id,
                    file_url
                ) VALUES (
                    v_form_id,
                    v_media_url
                );
            END IF;
        END LOOP;
    END IF;

    RETURN v_form_id;
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
