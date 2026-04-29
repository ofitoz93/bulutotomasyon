-- 1. Add manager password to clients
ALTER TABLE public.tmgd_clients ADD COLUMN IF NOT EXISTS manager_password TEXT;

-- 2. Add form flow types to transport docs
ALTER TABLE public.tmgd_transport_docs ADD COLUMN IF NOT EXISTS flow_type TEXT;
ALTER TABLE public.tmgd_transport_docs ADD COLUMN IF NOT EXISTS form_type TEXT;

-- 3. Update auth function to check both passwords
CREATE OR REPLACE FUNCTION public.tmgd_public_auth(p_slug TEXT, p_password TEXT)
RETURNS jsonb AS $$
DECLARE
  v_client record;
  v_company record;
  v_role TEXT;
BEGIN
  -- First check manager password
  SELECT * INTO v_client FROM public.tmgd_clients 
  WHERE url_slug = p_slug AND manager_password = p_password AND is_active = true;
  
  IF FOUND THEN
      v_role := 'manager';
  ELSE
      -- Fallback to access password
      SELECT * INTO v_client FROM public.tmgd_clients 
      WHERE url_slug = p_slug AND access_password = p_password AND is_active = true;
      IF NOT FOUND THEN RETURN NULL; END IF;
      v_role := 'user';
  END IF;
  
  SELECT * INTO v_company FROM public.companies WHERE id = v_client.tenant_id;
  
     RETURN json_build_object(
      'id', v_client.id,
      'tenant_id', v_client.tenant_id,
      'title', v_client.title,
      'address', v_client.address,
      'tel', v_client.tel,
      'fax', v_client.fax,
      'logo_url', v_client.logo_url,
      'doc_limit', v_client.doc_limit,
      'tmgd_logo_url', v_company.tmgd_logo_url,
      'role', v_role
   )::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Update get docs to include new fields
CREATE OR REPLACE FUNCTION public.tmgd_public_get_docs(p_client_id UUID)
RETURNS jsonb AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', d.id,
                'created_at', d.created_at,
                'date', d.date,
                'waybill_no', d.waybill_no,
                'order_no', d.order_no,
                'transport_id_no', d.transport_id_no,
                'receiver_title', d.receiver_title,
                'receiver_address', d.receiver_address,
                'receiver_tel', d.receiver_tel,
                'is_multimodal', d.is_multimodal,
                'is_limited', d.is_limited,
                'is_excepted', d.is_excepted,
                'is_env_hazardous', d.is_env_hazardous,
                'sender_name', d.sender_name,
                'sender_signature', d.sender_signature,
                'carrier_company', d.carrier_company,
                'driver_name', d.driver_name,
                'driver_plate', d.driver_plate,
                'driver_signature', d.driver_signature,
                'total_1136_points', d.total_1136_points,
                'status', d.status,
                'adr_checklist', d.adr_checklist,
                'flow_type', d.flow_type,
                'form_type', d.form_type,
                'items', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'id', i.id,
                            'product_id', i.product_id,
                            'package_type', i.package_type,
                            'package_count', i.package_count,
                            'quantity', i.quantity,
                            'total_points', i.total_points
                        )
                    ), '[]'::jsonb)
                    FROM public.tmgd_transport_items i WHERE i.doc_id = d.id
                )
            )
        ), '[]'::jsonb)
        FROM (
            SELECT * FROM public.tmgd_transport_docs 
            WHERE client_id = p_client_id 
            ORDER BY created_at DESC
        ) d
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Update create doc to save new fields and status
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
      client_id, tenant_id, date, waybill_no, order_no, transport_id_no, receiver_title, receiver_address, receiver_tel, 
      is_multimodal, is_limited, is_excepted, is_env_hazardous, sender_name, sender_signature, carrier_company, 
      driver_name, driver_plate, driver_signature, total_1136_points, status, adr_checklist,
      flow_type, form_type
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
      COALESCE(p_doc->>'status', 'draft'),
      CASE WHEN p_doc->'adr_checklist' IS NULL THEN '{}'::jsonb ELSE p_doc->'adr_checklist' END,
      p_doc->>'flow_type',
      p_doc->>'form_type'
   ) RETURNING id INTO v_doc_id;

   -- 2. Insert Items
   IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
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
   END IF;

   RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Update update_doc function
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
   -- Verify ownership
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
      status = COALESCE(p_doc->>'status', status),
      adr_checklist = CASE WHEN p_doc->'adr_checklist' IS NULL THEN '{}'::jsonb ELSE p_doc->'adr_checklist' END,
      flow_type = COALESCE(p_doc->>'flow_type', flow_type),
      form_type = COALESCE(p_doc->>'form_type', form_type)
   WHERE id = p_doc_id;

   -- 2. Clear and Re-insert items
   DELETE FROM public.tmgd_transport_items WHERE doc_id = p_doc_id;

   IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
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
   END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
