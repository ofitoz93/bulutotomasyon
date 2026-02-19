-- =============================================
-- EKİPMAN TAKİP MODÜLÜ - VERİTABANI TABLOLARI
-- =============================================

-- 1. Ekipman Kategorileri
CREATE TABLE IF NOT EXISTS public.equipment_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Yetkili Muayene Kuruluşları / Mühendisler
CREATE TABLE IF NOT EXISTS public.equipment_inspectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('kuruluş', 'mühendis')), -- A tipi / B tipi kuruluş veya sertifikalı mühendis
    certificate_no TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Ana Ekipman Tablosu
CREATE TABLE IF NOT EXISTS public.equipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),

    -- Kimlik bilgileri
    code TEXT NOT NULL,                  -- Makine kodu
    name TEXT NOT NULL,                  -- Ekipman adı
    type TEXT,                           -- Tip (vinç, kompresör, forklift, vb.)
    serial_no TEXT,                      -- Seri numarası
    brand TEXT,                          -- Marka
    model TEXT,                          -- Model
    category_id UUID REFERENCES public.equipment_categories(id),
    purpose TEXT,                        -- Kullanım amacı

    -- Teslim bilgisi
    assigned_to TEXT,                    -- Teslim edilen kişi / firma

    -- Risk & Periyot
    risk_level TEXT NOT NULL DEFAULT 'orta' CHECK (risk_level IN ('düşük', 'orta', 'yüksek')),
    inspection_period_months INTEGER NOT NULL DEFAULT 6, -- Özelleştirilebilir periyot

    -- Lokasyon
    default_location TEXT,               -- İlk/varsayılan lokasyon
    current_location TEXT,               -- Güncel lokasyon (QR ile güncellenen)

    -- QR
    qr_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    -- Tarihler
    purchase_date DATE,
    manufacture_year INTEGER,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Lokasyon Geçmişi (QR tarandığında kaydedilir)
CREATE TABLE IF NOT EXISTS public.equipment_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
    location TEXT NOT NULL,
    scanned_by TEXT,                     -- Tarayan kişi (anonim veya girilen isim)
    scanned_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Periyodik Bakım / Kontrol Kayıtları
CREATE TABLE IF NOT EXISTS public.equipment_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    performed_by UUID REFERENCES auth.users(id),

    -- Tarihler
    inspection_date DATE NOT NULL,
    next_inspection_date DATE NOT NULL,

    -- Yetkili
    inspector_id UUID REFERENCES public.equipment_inspectors(id),
    inspector_name_override TEXT,       -- Kuruluş listede yoksa serbest metin

    -- Sonuç
    result TEXT NOT NULL DEFAULT 'uygun' CHECK (result IN ('uygun', 'koşullu uygun', 'uygunsuz')),
    notes TEXT,

    -- Belge
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,

    reminder_days_before INTEGER DEFAULT 30,
    reminder_sent BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS devre dışı (mevcut migrasyonlarla uyumlu)
ALTER TABLE public.equipment_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_inspectors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_inspections DISABLE ROW LEVEL SECURITY;

-- NOT: Bakım belgesi yüklemek için Supabase Dashboard'dan
-- 'equipment-files' adında bir storage bucket oluşturun.

-- Ekipman Takip modülünü sisteme ekle (Super Admin panelinde görünmesi için)
INSERT INTO public.modules (key, name, description)
VALUES ('ekipman_takip', 'Ekipman Takip', 'İSG ve bakım ekipleri için periyodik ekipman kontrol, QR bazlı lokasyon takip ve bakım kayıt sistemi.')
ON CONFLICT (key) DO NOTHING;

-- NOT: equipment_categories tablosu tenant bazlı çalışır.
-- Her tenant kendi kategorilerini kendisi oluşturur (UI üzerinden "+" butonuyla).
-- Aşağıdaki kategoriler referans amaçlı yorum olarak verilmiştir:
--
-- Kaldırma Araçları     (vinç, forklift, istif makinesi vb.)
-- Basınçlı Ekipmanlar   (kompresör, hava tankı, kazan vb.)
-- Elektrik Ekipmanları  (pano, trafo, jeneratör vb.)
-- Pnömatik Ekipmanlar   (pnömatik motor, silindir vb.)
-- İş Makineleri          (iş makinesi, ekskavatör vb.)
-- Ölçüm Aletleri         (manometre, termometre vb.)
-- Koruyucu Ekipmanlar    (baret, iş güvenliği ekipmanı vb.)

