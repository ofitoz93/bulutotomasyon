-- 1. Make user_id nullable in adr_forms to allow portal submissions
ALTER TABLE public.adr_forms ALTER COLUMN user_id DROP NOT NULL;

-- 2. Update tmgd_public_create_doc to sync with ADR module
CREATE OR REPLACE FUNCTION public.tmgd_public_create_doc(
   p_client_id UUID,
   p_doc jsonb,
   p_items jsonb
) RETURNS UUID AS $$
DECLARE
   v_doc_id UUID;
   v_adr_id UUID;
   v_item jsonb;
   v_check_key TEXT;
   v_check_val TEXT;
   v_tenant_id UUID;
BEGIN
   SELECT tenant_id INTO v_tenant_id FROM public.tmgd_clients WHERE id = p_client_id;
   IF NOT FOUND THEN RETURN NULL; END IF;

   -- 1. Insert TMGD Transport Doc
   INSERT INTO public.tmgd_transport_docs (
      client_id, tenant_id, date, waybill_no, order_no, transport_id_no, receiver_title, receiver_address, receiver_tel, is_multimodal, is_limited, is_excepted, is_env_hazardous, sender_name, sender_signature, carrier_company, driver_name, driver_plate, driver_signature, total_1136_points, status, adr_checklist
   )
   VALUES (
      p_client_id, v_tenant_id, 
      (p_doc->>'date')::date,
      p_doc->>'waybill_no',
      p_doc->>'order_no',
      p_doc->>'transport_id_no',
      p_doc->>'receiver_title',
      p_doc->>'receiver_address',
      p_doc->>'receiver_tel',
      (p_doc->>'is_multimodal')::boolean,
      (p_doc->>'is_limited')::boolean,
      (p_doc->>'is_excepted')::boolean,
      (p_doc->>'is_env_hazardous')::boolean,
      p_doc->>'sender_name',
      p_doc->>'sender_signature',
      p_doc->>'carrier_company',
      p_doc->>'driver_name',
      p_doc->>'driver_plate',
      p_doc->>'driver_signature',
      (p_doc->>'total_1136_points')::numeric,
      'draft',
      CASE WHEN p_doc->'adr_checklist' IS NULL THEN '{}'::jsonb ELSE p_doc->'adr_checklist' END
   ) RETURNING id INTO v_doc_id;

   -- 2. Insert Items (TMGD)
   FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
   LOOP
      INSERT INTO public.tmgd_transport_items (
         doc_id, product_id, package_type, package_count, quantity, total_points
      ) VALUES (
         v_doc_id,
         (v_item->>'product_id')::uuid,
         v_item->>'package_type',
         (v_item->>'package_count')::numeric,
         (v_item->>'quantity')::numeric,
         (v_item->>'total_points')::numeric
      );
   END LOOP;

   -- 3. SYNC TO ADR MODULE: Create adr_forms record
   INSERT INTO public.adr_forms (
      company_id, -- company_id is tenant_id
      user_id,    -- nullable for portal
      form_type,
      status, 
      plate_no,
      driver_name,
      driver_signature,
      notes,
      created_at
   ) VALUES (
      v_tenant_id,
      NULL,
      'YUKLEYEN-GONDEREN',
      'pending',
      p_doc->>'driver_plate',
      p_doc->>'driver_name',
      p_doc->>'driver_signature',
      COALESCE(p_doc->>'notes', '') || ' (Portal üzerinden oluşturuldu)',
      NOW()
   ) RETURNING id INTO v_adr_id;

   -- 4. Sync Checklist to form_answers
   IF p_doc->'adr_checklist' IS NOT NULL THEN
      FOR v_check_key, v_check_val IN SELECT * FROM jsonb_each_text(p_doc->'adr_checklist')
      LOOP
         INSERT INTO public.form_answers (form_id, question_key, answer_value)
         VALUES (v_adr_id, v_check_key, jsonb_build_object('result', INITCAP(v_check_val)));
      END LOOP;
   END IF;

   RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Update update RPC for sync (if needed, but usually portal docs are updated via the doc_id)
-- We'll link the adr_form to the transport doc for future updates if necessary, 
-- but for now simple creation sync is what user asked.
