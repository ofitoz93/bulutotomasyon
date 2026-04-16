-- 1. Add jsonb column to tmgd_transport_docs
ALTER TABLE public.tmgd_transport_docs ADD COLUMN IF NOT EXISTS adr_checklist JSONB DEFAULT '{}'::jsonb;

-- 2. Drop and Recreate tmgd_public_create_doc
DROP FUNCTION IF EXISTS public.tmgd_public_create_doc(uuid, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.tmgd_public_create_doc(
   p_client_id UUID,
   p_doc jsonb,
   p_items jsonb
) RETURNS UUID AS $$
DECLARE
   v_doc_id UUID;
   v_item jsonb;
   v_tenant_id UUID;
BEGIN
   SELECT tenant_id INTO v_tenant_id FROM public.tmgd_clients WHERE id = p_client_id;
   IF NOT FOUND THEN RETURN NULL; END IF;

   -- 1. Insert Doc
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

   -- 2. Insert Items
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

   RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Drop and Recreate tmgd_public_update_doc
DROP FUNCTION IF EXISTS public.tmgd_public_update_doc(uuid, uuid, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.tmgd_public_update_doc(
   p_doc_id UUID,
   p_client_id UUID,
   p_doc jsonb,
   p_items jsonb
) RETURNS VOID AS $$
DECLARE
   v_item jsonb;
   v_tenant_id UUID;
BEGIN
   -- Verif ownership
   SELECT tenant_id INTO v_tenant_id FROM public.tmgd_transport_docs WHERE id = p_doc_id AND client_id = p_client_id;
   IF NOT FOUND THEN RETURN; END IF;

   -- 1. Update Doc
   UPDATE public.tmgd_transport_docs SET
      date = (p_doc->>'date')::date,
      waybill_no = p_doc->>'waybill_no',
      order_no = p_doc->>'order_no',
      transport_id_no = p_doc->>'transport_id_no',
      receiver_title = p_doc->>'receiver_title',
      receiver_address = p_doc->>'receiver_address',
      receiver_tel = p_doc->>'receiver_tel',
      is_multimodal = (p_doc->>'is_multimodal')::boolean,
      is_limited = (p_doc->>'is_limited')::boolean,
      is_excepted = (p_doc->>'is_excepted')::boolean,
      is_env_hazardous = (p_doc->>'is_env_hazardous')::boolean,
      sender_name = p_doc->>'sender_name',
      sender_signature = p_doc->>'sender_signature',
      carrier_company = p_doc->>'carrier_company',
      driver_name = p_doc->>'driver_name',
      driver_plate = p_doc->>'driver_plate',
      driver_signature = p_doc->>'driver_signature',
      total_1136_points = (p_doc->>'total_1136_points')::numeric,
      adr_checklist = CASE WHEN p_doc->'adr_checklist' IS NULL THEN '{}'::jsonb ELSE p_doc->'adr_checklist' END,
      updated_at = NOW()
   WHERE id = p_doc_id;

   -- 2. Clear and Re-insert items
   DELETE FROM public.tmgd_transport_items WHERE doc_id = p_doc_id;

   FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
   LOOP
      INSERT INTO public.tmgd_transport_items (
         doc_id, product_id, package_type, package_count, quantity, total_points
      ) VALUES (
         p_doc_id,
         (v_item->>'product_id')::uuid,
         v_item->>'package_type',
         (v_item->>'package_count')::numeric,
         (v_item->>'quantity')::numeric,
         (v_item->>'total_points')::numeric
      );
   END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
