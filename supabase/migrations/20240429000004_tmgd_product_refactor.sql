-- 1. Ürün tipini (Ürün / Atık) belirten sütun ekle
ALTER TABLE public.tmgd_products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'product';

-- 2. client_id sütununu opsiyonel yap (Global katalog için)
ALTER TABLE public.tmgd_products ALTER COLUMN client_id DROP NOT NULL;

-- 3. Ürün-Firma İlişki Tablosu (Atama için)
CREATE TABLE IF NOT EXISTS public.tmgd_client_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.tmgd_clients(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.tmgd_products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, product_id)
);

ALTER TABLE public.tmgd_client_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_all_tmgd_client_products" ON public.tmgd_client_products;
CREATE POLICY "tenant_all_tmgd_client_products" ON public.tmgd_client_products 
FOR ALL TO authenticated 
USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 4. Mevcut verileri yeni yapıya taşı (Opsiyonel ama iyi olur)
-- Her ürün için bir atama kaydı oluştur
INSERT INTO public.tmgd_client_products (tenant_id, client_id, product_id)
SELECT tenant_id, client_id, id FROM public.tmgd_products
WHERE client_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. Public RPC Fonksiyonunu Güncelle (Atanan ürünleri getirsin)
CREATE OR REPLACE FUNCTION public.tmgd_public_get_products(p_client_id UUID)
RETURNS SETOF public.tmgd_products AS $$
BEGIN
   RETURN QUERY 
   SELECT p.* 
   FROM public.tmgd_products p
   INNER JOIN public.tmgd_client_products cp ON cp.product_id = p.id
   WHERE cp.client_id = p_client_id 
   AND p.is_active = true 
   ORDER BY p.short_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
