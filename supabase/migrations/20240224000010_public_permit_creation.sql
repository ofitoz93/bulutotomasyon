-- =============================================
-- PUBLIC WORK PERMIT CREATION RPCS
-- =============================================

-- 1. Get user context and projects using TC or Sicil
CREATE OR REPLACE FUNCTION public.public_get_permit_context(p_sicil_tc TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_full_name TEXT;
    v_projects JSON;
BEGIN
    -- Find user by TC or Sicil
    SELECT id, tenant_id, first_name || ' ' || last_name
    INTO v_user_id, v_tenant_id, v_full_name
    FROM public.profiles
    WHERE tc_no = p_sicil_tc OR company_employee_no = p_sicil_tc
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Kullanıcı bulunamadı. Lütfen geçerli bir TC veya Sicil numarası giriniz.';
    END IF;

    -- Fetch projects for this tenant
    SELECT json_agg(row_to_json(p))
    INTO v_projects
    FROM (
        SELECT id, name 
        FROM public.action_projects 
        WHERE company_id = v_tenant_id
        ORDER BY name
    ) p;

    RETURN json_build_object(
        'user_id', v_user_id,
        'tenant_id', v_tenant_id,
        'full_name', v_full_name,
        'projects', COALESCE(v_projects, '[]'::json)
    );
END;
$$;

-- 2. Create the permit and coworkers
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
BEGIN
    -- Insert Permit
    INSERT INTO public.work_permits (
        tenant_id,
        created_by,
        work_date,
        estimated_hours,
        company_name,
        department,
        project_id,
        job_types,
        job_type_other,
        hazards,
        hazard_other,
        ppe_requirements,
        ppe_other,
        precautions,
        precaution_other,
        creator_tc_no,
        status
    ) VALUES (
        p_tenant_id,
        p_user_id,
        (p_permit_data->>'work_date')::date,
        (p_permit_data->>'estimated_hours')::numeric,
        p_permit_data->>'company_name',
        p_permit_data->>'department',
        (p_permit_data->>'project_id')::uuid,
        p_permit_data->'job_types',
        p_permit_data->>'job_type_other',
        p_permit_data->'hazards',
        p_permit_data->>'hazard_other',
        p_permit_data->'ppe_requirements',
        p_permit_data->>'ppe_other',
        p_permit_data->'precautions',
        p_permit_data->>'precaution_other',
        p_permit_data->>'creator_tc_no',
        'pending'
    ) RETURNING id INTO v_permit_id;

    -- Insert Coworkers
    IF p_permit_data->'coworkers' IS NOT NULL THEN
        FOR v_coworker IN SELECT * FROM jsonb_array_elements(p_permit_data->'coworkers')
        LOOP
            INSERT INTO public.work_permit_coworkers (
                permit_id,
                full_name,
                location,
                tc_no,
                sicil_no
            ) VALUES (
                v_permit_id,
                v_coworker->>'full_name',
                v_coworker->>'location',
                v_coworker->>'tc_no',
                v_coworker->>'sicil_no'
            );
        END LOOP;
    END IF;

    RETURN v_permit_id;
END;
$$;
