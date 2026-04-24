-- =============================================
-- SU YÖNETİMİ VE VERİMLİLİK MODÜLÜ
-- =============================================

-- 1. Lokasyon Tanımları (Su Yönetimi Özel)
CREATE TABLE IF NOT EXISTS public.water_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    total_area_m2 DECIMAL(10,2), -- Toplam alan (m2)
    personnel_capacity INTEGER, -- Kapasite (opsiyonel)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tüketim Kayıtları
CREATE TABLE IF NOT EXISTS public.water_consumption_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.water_locations(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL,
    consumption_m3 DECIMAL(12,2) NOT NULL, -- m3 cinsinden tüketim
    headcount INTEGER NOT NULL, -- O ayki kişi sayısı
    total_cost DECIMAL(12,2), -- Toplam maliyet (opsiyonel)
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(location_id, period_month, period_year)
);

-- RLS Ayarları
ALTER TABLE public.water_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_consumption_records ENABLE ROW LEVEL SECURITY;

-- Politikalar
CREATE POLICY "Users can view their own company's water locations" ON public.water_locations
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their own company's water locations" ON public.water_locations
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their own company's water consumption" ON public.water_consumption_records
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their own company's water consumption" ON public.water_consumption_records
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Modül Tanımı
INSERT INTO public.modules (key, name, description)
VALUES ('su_yonetimi', 'Su Yönetimi', 'Su tüketim analizi, kişi başı verimlilik ve anomali tespiti modülü.')
ON CONFLICT (key) DO NOTHING;

-- Örnek Veriler (Opsiyonel: İlk kurulumda yardımcı olması için)
-- Not: Bu veriler sadece tenant_id'si bilinen bir şirket için anlamlıdır. 
-- UI üzerinden eklemek daha sağlıklı olsa da tablo yapısını test etmek için burada bırakılabilir.
