-- =============================================
-- EKİPMAN TAKİP MODÜLÜ - HASAR/ARIZA BİLDİRİM EKLENTİSİ
-- =============================================

-- 1. Ekipmanlar tablosuna hasar durumu sütunu ekleyelim
ALTER TABLE public.equipments 
ADD COLUMN IF NOT EXISTS is_damaged BOOLEAN DEFAULT false;

-- 2. Hasar bildirim (arıza) geçmişi tablosu
CREATE TABLE IF NOT EXISTS public.equipment_fault_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    
    reported_by_name TEXT,                  -- Sahadan bildiren kişi (isim)
    description TEXT NOT NULL,              -- Arıza / Hasar detayı
    location TEXT,                          -- Arıza bildirildiği andaki GPS konumu
    
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS devre dışı (mevcut ekipman takibi modül yapısıyla uyumlu kalmak için)
ALTER TABLE public.equipment_fault_reports DISABLE ROW LEVEL SECURITY;
