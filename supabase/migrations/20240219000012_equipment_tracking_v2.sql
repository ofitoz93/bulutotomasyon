-- =============================================
-- EKİPMAN TAKİP v2 - Ekipman Adı Listesi + Bakım Tarihi Kolonları
-- =============================================

-- 1. Şirkete özel ekipman adı listesi (equipment_definitions)
CREATE TABLE IF NOT EXISTS public.equipment_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, name)
);
ALTER TABLE public.equipment_definitions DISABLE ROW LEVEL SECURITY;

-- 2. Ekipmana next_inspection_date ve last_inspection_date doğrudan kolonu ekle
ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS next_inspection_date DATE;
ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS last_inspection_date DATE;
