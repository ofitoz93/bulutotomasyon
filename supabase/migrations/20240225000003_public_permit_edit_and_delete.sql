-- =============================================
-- PUBLIC WORK PERMIT: EDIT, DELETE, AND VALIDATION EXPANSION
-- =============================================

-- =============================================
-- 1. Get user's previously created permits
-- =============================================
CREATE OR REPLACE FUNCTION public.public_get_my_created_permits(p_sicil_tc TEXT)
RETURNS TABLE (
    id UUID,
    work_date DATE,
    company_name TEXT,
    department TEXT,
    estimated_hours NUMERIC,
    status TEXT,
    created_at TIMESTAMPTZ,
    job_types JSONB,
    job_type_other TEXT,
    hazards JSONB,
    hazard_other TEXT,
    ppe_requirements JSONB,
    ppe_other TEXT,
    precautions JSONB,
    precaution_other TEXT,
    project_id UUID,
    coworkers JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
BEGIN
    SELECT p.id, p.tenant_id INTO v_user_id, v_tenant_id
    FROM public.profiles p
    WHERE p.tc_no = p_sicil_tc OR p.company_employee_no = p_sicil_tc
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Kullanıcı bulunamadı. Lütfen geçerli bir TC veya Sicil numarası giriniz.';
    END IF;

    RETURN QUERY
    SELECT 
        wp.id, wp.work_date, wp.company_name, wp.department, wp.estimated_hours, 
        wp.status::TEXT, wp.created_at, wp.job_types, wp.job_type_other, 
        wp.hazards, wp.hazard_other, wp.ppe_requirements, wp.ppe_other, 
        wp.precautions, wp.precaution_other, wp.project_id,
        (
            SELECT json_agg(json_build_object(
                'id', wpc.id,
                'full_name', wpc.full_name,
                'location', wpc.location,
                'tc_no', wpc.tc_no,
                'sicil_no', wpc.sicil_no,
                'is_approved', wpc.is_approved
            ))
            FROM public.work_permit_coworkers wpc
            WHERE wpc.permit_id = wp.id
        ) as coworkers
    FROM public.work_permits wp
    WHERE wp.created_by = v_user_id AND wp.tenant_id = v_tenant_id
    ORDER BY wp.created_at DESC;
END;
$$;


-- =============================================
-- 2. Create Permit (Overwritten to Add Validation)
-- =============================================
CREATE OR REPLACE FUNCTION public.public_create_work_permit(
    p_user_id UUID,
    p_tenant_id UUID,
    p_permit_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_permit_id UUID;
    v_coworker JSONB;
    v_coworker_exists BOOLEAN;
    v_cw_tc TEXT;
    v_cw_sicil TEXT;
    v_cw_name TEXT;
BEGIN
    -- Validation: Check if every coworker exists in profiles for this company
    IF p_permit_data->'coworkers' IS NOT NULL THEN
        FOR v_coworker IN SELECT * FROM jsonb_array_elements(p_permit_data->'coworkers')
        LOOP
            v_cw_tc := v_coworker->>'tc_no';
            v_cw_sicil := v_coworker->>'sicil_no';
            v_cw_name := v_coworker->>'full_name';
            
            SELECT EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE tenant_id = p_tenant_id 
                AND (
                    (tc_no IS NOT NULL AND tc_no = v_cw_tc) OR 
                    (company_employee_no IS NOT NULL AND company_employee_no = v_cw_sicil)
                )
            ) INTO v_coworker_exists;

            IF NOT v_coworker_exists THEN
                RAISE EXCEPTION 'Eklediğiniz çalışan (% - % / %) şirket kayıtlarında (TC / Sicil ile) bulunamadı. Lütfen kontrol edin.', v_cw_name, v_cw_tc, v_cw_sicil;
            END IF;
        END LOOP;
    END IF;

    -- Insert Permit
    INSERT INTO public.work_permits (
        tenant_id, created_by, work_date, estimated_hours, company_name, department, project_id,
        job_types, job_type_other, hazards, hazard_other, ppe_requirements, ppe_other,
        precautions, precaution_other, creator_tc_no, status
    ) VALUES (
        p_tenant_id, p_user_id, (p_permit_data->>'work_date')::date, (p_permit_data->>'estimated_hours')::numeric,
        p_permit_data->>'company_name', p_permit_data->>'department', (p_permit_data->>'project_id')::uuid,
        p_permit_data->'job_types', p_permit_data->>'job_type_other', p_permit_data->'hazards', p_permit_data->>'hazard_other',
        p_permit_data->'ppe_requirements', p_permit_data->>'ppe_other', p_permit_data->'precautions', p_permit_data->>'precaution_other',
        p_permit_data->>'creator_tc_no', 'pending'
    ) RETURNING id INTO v_permit_id;

    -- Insert Coworkers
    IF p_permit_data->'coworkers' IS NOT NULL THEN
        FOR v_coworker IN SELECT * FROM jsonb_array_elements(p_permit_data->'coworkers')
        LOOP
            INSERT INTO public.work_permit_coworkers (
                permit_id, full_name, location, tc_no, sicil_no
            ) VALUES (
                v_permit_id, v_coworker->>'full_name', v_coworker->>'location', v_coworker->>'tc_no', v_coworker->>'sicil_no'
            );
        END LOOP;
    END IF;

    RETURN v_permit_id;
END;
$$;


-- =============================================
-- 3. Update existing permit from public form
-- =============================================
CREATE OR REPLACE FUNCTION public.public_update_work_permit(
    p_permit_id UUID,
    p_sicil_tc TEXT,
    p_permit_data JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_permit_owner UUID;
    v_permit_status TEXT;
    
    v_coworker JSONB;
    v_coworker_exists BOOLEAN;
    v_cw_tc TEXT;
    v_cw_sicil TEXT;
    v_cw_name TEXT;
BEGIN
    -- Get user context
    SELECT p.id, p.tenant_id INTO v_user_id, v_tenant_id
    FROM public.profiles p
    WHERE p.tc_no = p_sicil_tc OR p.company_employee_no = p_sicil_tc
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Kullanıcı bulunamadı. Lütfen geçerli bir TC veya Sicil numarası giriniz.';
    END IF;

    -- Verify Permit Ownership and Status
    SELECT created_by, status INTO v_permit_owner, v_permit_status
    FROM public.work_permits
    WHERE id = p_permit_id AND tenant_id = v_tenant_id;

    IF v_permit_owner IS NULL THEN
        RAISE EXCEPTION 'İş izni bulunamadı.';
    END IF;

    IF v_permit_owner != v_user_id THEN
        RAISE EXCEPTION 'Sadece kendi oluşturduğunuz iş izinlerini yetkilendirebilirsiniz/düzenleyebilirsiniz.';
    END IF;

    IF v_permit_status != 'pending' THEN
        RAISE EXCEPTION 'Bu iş izni halihazırda onay akışında olduğu veya tamamlandığı için düzenlenemez.';
    END IF;

    -- Validation: Check if every coworker exists in profiles for this company
    IF p_permit_data->'coworkers' IS NOT NULL THEN
        FOR v_coworker IN SELECT * FROM jsonb_array_elements(p_permit_data->'coworkers')
        LOOP
            v_cw_tc := v_coworker->>'tc_no';
            v_cw_sicil := v_coworker->>'sicil_no';
            v_cw_name := v_coworker->>'full_name';
            
            SELECT EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE tenant_id = v_tenant_id 
                AND (
                    (tc_no IS NOT NULL AND tc_no = v_cw_tc) OR 
                    (company_employee_no IS NOT NULL AND company_employee_no = v_cw_sicil)
                )
            ) INTO v_coworker_exists;

            IF NOT v_coworker_exists THEN
                RAISE EXCEPTION 'Eklediğiniz çalışan (% - % / %) şirket kayıtlarında (TC / Sicil ile) bulunamadı. Lütfen kontrol edin.', v_cw_name, v_cw_tc, v_cw_sicil;
            END IF;
        END LOOP;
    END IF;

    -- Update Permit
    UPDATE public.work_permits SET
        work_date = (p_permit_data->>'work_date')::date,
        estimated_hours = (p_permit_data->>'estimated_hours')::numeric,
        company_name = p_permit_data->>'company_name',
        department = p_permit_data->>'department',
        project_id = (p_permit_data->>'project_id')::uuid,
        job_types = p_permit_data->'job_types',
        job_type_other = p_permit_data->>'job_type_other',
        hazards = p_permit_data->'hazards',
        hazard_other = p_permit_data->>'hazard_other',
        ppe_requirements = p_permit_data->'ppe_requirements',
        ppe_other = p_permit_data->>'ppe_other',
        precautions = p_permit_data->'precautions',
        precaution_other = p_permit_data->>'precaution_other'
    WHERE id = p_permit_id;

    -- Update Coworkers: To keep things simple and safe, delete all and re-insert 
    -- (since we wouldn't want to preserve "is_approved" if the coworker was removed and re-added)
    DELETE FROM public.work_permit_coworkers WHERE permit_id = p_permit_id;

    IF p_permit_data->'coworkers' IS NOT NULL THEN
        FOR v_coworker IN SELECT * FROM jsonb_array_elements(p_permit_data->'coworkers')
        LOOP
            INSERT INTO public.work_permit_coworkers (
                permit_id, full_name, location, tc_no, sicil_no
            ) VALUES (
                p_permit_id, v_coworker->>'full_name', v_coworker->>'location', v_coworker->>'tc_no', v_coworker->>'sicil_no'
            );
        END LOOP;
    END IF;

    RETURN TRUE;
END;
$$;
