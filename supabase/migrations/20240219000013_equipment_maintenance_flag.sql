-- =============================================
-- EKİPMAN TAKİP v3 - Bakım Gerekli Kontrolü
-- =============================================

-- Ekipman tablosuna bakım gerekli mi (maintenance_required) kolonu ekle
-- Varsayılan değer TRUE (bakım gerekli)
ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS maintenance_required BOOLEAN DEFAULT true;

-- Şema önbelleğini yenile
NOTIFY pgrst, 'reload schema';
