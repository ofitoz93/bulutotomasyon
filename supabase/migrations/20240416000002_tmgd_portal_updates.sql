-- Client'a ait belgeleri (içerisindeki öğelerle beraber) getiren fonsksiyon
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


-- Belge ve Öğelerini Güncelleme Fonksiyonu
CREATE OR REPLACE FUNCTION public.tmgd_public_update_doc(
   p_doc_id UUID,
   p_client_id UUID,
   p_doc jsonb,
   p_items jsonb
) RETURNS BOOLEAN AS $$
DECLARE
   v_item jsonb;
BEGIN
   -- Güvenlik Kontrolü: Evrak gerçekten bu müşteriye mi ait?
   IF NOT EXISTS (SELECT 1 FROM public.tmgd_transport_docs WHERE id = p_doc_id AND client_id = p_client_id) THEN
      RETURN false;
   END IF;

   -- 1. Evrakı (Doc) Güncelle
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
       total_1136_points = (p_doc->>'total_1136_points')::float
   WHERE id = p_doc_id AND client_id = p_client_id;

   -- 2. Mevcut itemları temizleyip yerlerine yenilerini ekle
   DELETE FROM public.tmgd_transport_items WHERE doc_id = p_doc_id;

   FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
   LOOP
      INSERT INTO public.tmgd_transport_items (
         doc_id, product_id, package_type, package_count, quantity, total_points
      ) VALUES (
         p_doc_id, (v_item->>'product_id')::uuid, v_item->>'package_type', (v_item->>'package_count')::int, (v_item->>'quantity')::float, (v_item->>'total_points')::float
      );
   END LOOP;

   RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


GRANT EXECUTE ON FUNCTION public.tmgd_public_get_docs(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tmgd_public_update_doc(UUID, UUID, jsonb, jsonb) TO anon, authenticated;
