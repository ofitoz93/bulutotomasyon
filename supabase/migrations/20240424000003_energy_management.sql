-- =============================================
-- ENERJİ YÖNETİMİ VE VERİMLİLİK MODÜLÜ
-- =============================================

-- 1. Lokasyon Tanımları (Enerji Yönetimi Özel)
CREATE TABLE IF NOT EXISTS public.energy_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    total_area_m2 DECIMAL(10,2),
    personnel_capacity INTEGER,
    target_reduction_percent DECIMAL(5,2) DEFAULT 5.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tüketim Kayıtları (Enerji)
CREATE TABLE IF NOT EXISTS public.energy_consumption_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.energy_locations(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL,
    consumption_kwh DECIMAL(12,2) NOT NULL, -- kWh cinsinden tüketim
    headcount INTEGER NOT NULL,
    total_cost DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(location_id, period_month, period_year)
);

-- RLS Ayarları
ALTER TABLE public.energy_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_consumption_records ENABLE ROW LEVEL SECURITY;

-- Politikalar
CREATE POLICY "Users can view their own company's energy locations" ON public.energy_locations
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their own company's energy locations" ON public.energy_locations
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their own company's energy consumption" ON public.energy_consumption_records
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their own company's energy consumption" ON public.energy_consumption_records
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Modül Tanımı
INSERT INTO public.modules (key, name, description)
VALUES ('enerji_yonetimi', 'Enerji Yönetimi', 'Elektrik tüketim analizi, verimlilik ve tasarruf takibi modülü.')
ON CONFLICT (key) DO NOTHING;
