-- TMGD Taşıma Evrakı Modülü Kurulumu

-- 1. Şirketlere (Yönetici) Ana TMGD Logosu alanı ekle
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tmgd_logo_url TEXT;

-- 2. TMGD Firmasının Müşterileri (Hizmet Alan Firmalar)
CREATE TABLE IF NOT EXISTS public.tmgd_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    address TEXT,
    tel TEXT,
    fax TEXT,
    url_slug TEXT NOT NULL UNIQUE,
    access_password TEXT NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TMGD Müşterilerine Özel Ürünler (UN Katalog)
CREATE TABLE IF NOT EXISTS public.tmgd_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.tmgd_clients(id) ON DELETE CASCADE,
    short_name TEXT NOT NULL,
    un_nr TEXT,
    shipping_name TEXT,
    class_nr TEXT,
    pg TEXT,
    category TEXT,
    multiplier FLOAT DEFAULT 1,
    mua_1136 FLOAT DEFAULT 0,
    unit TEXT,
    tunnel_code TEXT,
    special_provisions TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TMGD Taşıma Evrakları (Dosyalar)
CREATE TABLE IF NOT EXISTS public.tmgd_transport_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.tmgd_clients(id) ON DELETE CASCADE,
    date DATE,
    waybill_no TEXT,
    order_no TEXT,
    transport_id_no TEXT,
    receiver_title TEXT,
    receiver_address TEXT,
    receiver_tel TEXT,
    
    is_multimodal BOOLEAN DEFAULT false,
    is_limited BOOLEAN DEFAULT false,
    is_excepted BOOLEAN DEFAULT false,
    is_env_hazardous BOOLEAN DEFAULT false,
    
    sender_name TEXT,
    sender_signature TEXT,
    carrier_company TEXT,
    driver_name TEXT,
    driver_plate TEXT,
    driver_signature TEXT,
    
    total_1136_points FLOAT DEFAULT 0,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Evrak İçindeki Yük (Ürün) Kalemleri
CREATE TABLE IF NOT EXISTS public.tmgd_transport_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES public.tmgd_transport_docs(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.tmgd_products(id),
    package_type TEXT,
    package_count INTEGER,
    quantity FLOAT,
    total_points FLOAT
);

-- Tablolara RLS Aktivasyonu (Admin Kullanıcıları İçin Korumalar)
ALTER TABLE public.tmgd_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmgd_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmgd_transport_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmgd_transport_items ENABLE ROW LEVEL SECURITY;

-- ADMIN İÇİN (Şirket Yöneticileri ve O Şirketin Çalışanları Kendi Kayıtlarını Görebilir/Yönetebilir)
DROP POLICY IF EXISTS "tenant_all_tmgd_clients" ON public.tmgd_clients;
CREATE POLICY "tenant_all_tmgd_clients" ON public.tmgd_clients FOR ALL TO authenticated USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_all_tmgd_products" ON public.tmgd_products;
CREATE POLICY "tenant_all_tmgd_products" ON public.tmgd_products FOR ALL TO authenticated USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_all_tmgd_docs" ON public.tmgd_transport_docs;
CREATE POLICY "tenant_all_tmgd_docs" ON public.tmgd_transport_docs FOR ALL TO authenticated USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_all_tmgd_items" ON public.tmgd_transport_items;
CREATE POLICY "tenant_all_tmgd_items" ON public.tmgd_transport_items FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tmgd_transport_docs WHERE id = tmgd_transport_items.doc_id AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
);


-- PUBLIC/ANON ERİŞİM İÇİN RPC FONKSİYONLAR (Public URL'den Çalışan Girebilsin Diye)

-- 1. Çalışan Giriş/Doğrulama (Şifre ile Cilent ve Ana Logo Çeker)
CREATE OR REPLACE FUNCTION public.tmgd_public_auth(p_slug TEXT, p_password TEXT)
RETURNS jsonb AS $$
DECLARE
  v_client record;
  v_company record;
BEGIN
  SELECT * INTO v_client FROM public.tmgd_clients WHERE url_slug = p_slug AND access_password = p_password AND is_active = true;
  IF NOT FOUND THEN RETURN NULL; END IF;
  
  SELECT * INTO v_company FROM public.companies WHERE id = v_client.tenant_id;
  
  RETURN json_build_object(
     'id', v_client.id,
     'tenant_id', v_client.tenant_id,
     'title', v_client.title,
     'address', v_client.address,
     'tel', v_client.tel,
     'fax', v_client.fax,
     'logo_url', v_client.logo_url,
     'tmgd_logo_url', v_company.tmgd_logo_url
  )::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Client'ın Ürünlerini (UN Listesi) Çekme
CREATE OR REPLACE FUNCTION public.tmgd_public_get_products(p_client_id UUID)
RETURNS SETOF public.tmgd_products AS $$
BEGIN
   RETURN QUERY SELECT * FROM public.tmgd_products WHERE client_id = p_client_id AND is_active = true ORDER BY short_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Taşıma Evrağını Yaratma (Anon tarafından tetiklenir)
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
      client_id, tenant_id, date, waybill_no, order_no, transport_id_no, receiver_title, receiver_address, receiver_tel, is_multimodal, is_limited, is_excepted, is_env_hazardous, sender_name, sender_signature, carrier_company, driver_name, driver_plate, driver_signature, total_1136_points, status
   )
   VALUES (
      p_client_id, v_tenant_id, 
      (p_doc->>'date')::date, p_doc->>'waybill_no', p_doc->>'order_no', p_doc->>'transport_id_no', p_doc->>'receiver_title', p_doc->>'receiver_address', p_doc->>'receiver_tel', (p_doc->>'is_multimodal')::boolean, (p_doc->>'is_limited')::boolean, (p_doc->>'is_excepted')::boolean, (p_doc->>'is_env_hazardous')::boolean, p_doc->>'sender_name', p_doc->>'sender_signature', p_doc->>'carrier_company', p_doc->>'driver_name', p_doc->>'driver_plate', p_doc->>'driver_signature', (p_doc->>'total_1136_points')::float, 'completed'
   ) RETURNING id INTO v_doc_id;

   -- 2. Insert Items
   FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
   LOOP
      INSERT INTO public.tmgd_transport_items (
         doc_id, product_id, package_type, package_count, quantity, total_points
      ) VALUES (
         v_doc_id, (v_item->>'product_id')::uuid, v_item->>'package_type', (v_item->>'package_count')::int, (v_item->>'quantity')::float, (v_item->>'total_points')::float
      );
   END LOOP;

   RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Herkes public RPC görebilsin diye izinler
GRANT EXECUTE ON FUNCTION public.tmgd_public_auth(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tmgd_public_get_products(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tmgd_public_create_doc(UUID, jsonb, jsonb) TO anon, authenticated;
