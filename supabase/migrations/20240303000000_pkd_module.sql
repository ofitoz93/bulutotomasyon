-- =============================================
-- PATLAMADAN KORUNMA DOKÜMANI (PKD) MODÜLÜ
-- =============================================

-- 1. Kimyasallar (chemicals)
CREATE TABLE IF NOT EXISTS public.pkd_chemicals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cas_no TEXT,
    state TEXT CHECK (state IN ('gaz', 'sıvı', 'toz')),
    flash_point NUMERIC,      -- Parlama noktası (°C)
    lel NUMERIC,              -- Alt patlama sınırı (% veya g/m3)
    uel NUMERIC,              -- Üst patlama sınırı (% veya g/m3)
    vapor_pressure NUMERIC,   -- Buhar basıncı (kPa)
    density NUMERIC,          -- Yoğunluk
    auto_ignition_temp NUMERIC, -- Kendiliğinden tutuşma sıcaklığı (°C)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Boşalma Kaynakları (release_sources)
CREATE TABLE IF NOT EXISTS public.pkd_release_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    grade TEXT CHECK (grade IN ('sürekli', 'ana', 'tali')),
    frequency TEXT,
    duration TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Havalandırma (ventilation)
CREATE TABLE IF NOT EXISTS public.pkd_ventilation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('doğal', 'suni')),
    degree TEXT CHECK (degree IN ('yüksek', 'orta', 'düşük')),
    availability TEXT CHECK (availability IN ('iyi', 'orta', 'zayıf')),
    velocity NUMERIC, -- Hava hızı (m/s)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Raporlar (pkd_reports) - Önceden oluşturulmalı ki zone tablosu referans verebilsin
CREATE TABLE IF NOT EXISTS public.pkd_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    title TEXT NOT NULL,
    version TEXT DEFAULT 'v1.0',
    status TEXT DEFAULT 'taslak' CHECK (status IN ('taslak', 'onay_bekliyor', 'onaylandı')),
    facility_name TEXT,
    process_name TEXT,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Kuşaklar / Zoneler (zones)
CREATE TABLE IF NOT EXISTS public.pkd_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    report_id UUID REFERENCES public.pkd_reports(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    chemical_id UUID REFERENCES public.pkd_chemicals(id),
    release_source_id UUID REFERENCES public.pkd_release_sources(id),
    ventilation_id UUID REFERENCES public.pkd_ventilation(id),
    zone_type TEXT CHECK (zone_type IN ('0', '1', '2', '20', '21', '22', 'tehlikesiz')),
    distance NUMERIC, -- Zon mesafesi (m)
    volume NUMERIC,   -- Vz (m3)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Ateşleme Kaynakları (ignition_sources)
CREATE TABLE IF NOT EXISTS public.pkd_ignition_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES public.pkd_zones(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- Elektrik, Statik, Mekanik Kıvılcım, Sıcak Yüzey vb.
    description TEXT,
    probability TEXT CHECK (probability IN ('yüksek', 'orta', 'düşük')),
    precautions TEXT,
    is_acceptable BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Ekipman ATEX Detayları (Mevcut ekipman tablosuna ek ilişki)
CREATE TABLE IF NOT EXISTS public.pkd_equipment_atex (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES public.pkd_zones(id) ON DELETE SET NULL,
    atex_code TEXT,       -- Örn: II 2G Ex db IIC T4 Gb
    equipment_group TEXT, -- I, II
    category TEXT,        -- 1, 2, 3, M1, M2
    atmosphere TEXT,      -- G (Gaz), D (Toz)
    temp_class TEXT,      -- T1, T2, T3, T4, T5, T6
    ip_rating TEXT,       -- IP65 vb.
    is_suitable BOOLEAN,  -- Zon için uygun mu?
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Devre Dışı Bırakma (Mevcut yapıya uygunluk için)
ALTER TABLE public.pkd_chemicals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pkd_release_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pkd_ventilation DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pkd_zones DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pkd_ignition_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pkd_equipment_atex DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pkd_reports DISABLE ROW LEVEL SECURITY;

-- İSG Merkezi alt modülü olarak ekleme 
INSERT INTO public.modules (key, name, description)
VALUES ('pkd_yonetimi', 'PKD Yönetimi', 'Patlamadan Korunma Dokümanı hazırlanması, Zone hesaplamaları ve ATEX ekipman uygunluk kontrolü.')
ON CONFLICT (key) DO NOTHING;
