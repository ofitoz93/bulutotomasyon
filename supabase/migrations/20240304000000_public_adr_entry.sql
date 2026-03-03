-- =====================================================
-- PUBLIC ADR ENTRY RPC AND POLICIES
-- =====================================================

-- 1. Storage policy for anon uploads to adr-uploads
-- We need to ensure that unauthenticated users can upload photos.
DROP POLICY IF EXISTS "ADR Medya Ekleme Anonim" ON storage.objects;
CREATE POLICY "ADR Medya Ekleme Anonim" ON storage.objects
FOR INSERT TO anon
WITH CHECK (bucket_id = 'adr-uploads');

-- 2. The RPC (Remote Procedure Call) for submitting the ADR form
-- This function runs with elevated privileges (SECURITY DEFINER)
-- so it can look up personnel by TC / Sicil No and insert records 
-- even if the user is not logged in.

CREATE OR REPLACE FUNCTION public.submit_public_adr_form(
    p_identity_no TEXT, -- TC Identity No or Employee ID
    p_form_type TEXT,
    p_plate_no TEXT,
    p_driver_name TEXT,
    p_location_lat FLOAT,
    p_location_lng FLOAT,
    p_notes TEXT,
    p_form_answers JSONB,
    p_form_media JSONB DEFAULT '[]'::jsonb
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
    -- based on the provided identity number.
    SELECT id, tenant_id INTO v_user_id, v_tenant_id
    FROM public.profiles
    WHERE tc_no = p_identity_no OR company_employee_no = p_identity_no
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Bu Kimlik veya Sicil Numarasına ait bir personel kaydı bulunamadı.';
    END IF;

    -- 2. Insert the main ADR form record
    INSERT INTO public.adr_forms (
        company_id,
        user_id,
        form_type,
        status,
        plate_no,
        driver_name,
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
        p_location_lat,
        p_location_lng,
        p_notes
    ) RETURNING id INTO v_form_id;

    -- 3. Insert form answers (looping over keys of the JSONB object)
    -- We expect p_form_answers to be a JSON object mapping question_key -> answer details
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

    -- 4. Insert form media (looping over JSONB array of strings)
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

    -- Return the ID of the newly created form
    RETURN v_form_id;
END;
$$;

-- 3. The RPC to check if an identity number exists
-- Used at the first step of the public form to ensure the user is an employee before they fill out the form
CREATE OR REPLACE FUNCTION public.check_employee_identity(p_identity_no TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE tc_no = p_identity_no OR company_employee_no = p_identity_no
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
