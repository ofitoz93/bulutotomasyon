-- =============================================
-- KULLANICI PROFİLİ ZORUNLU ALANLARI (TC NO VE ŞİRKET SİCİL NO)
-- =============================================

-- 1. profiles tablosuna yeni sütunlar ekle
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tc_no TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS company_employee_no TEXT;

-- 2. Aynı şirkette (tenant_id) birden fazla kişide aynı Sicil Numarası (company_employee_no) Mükerrerliğini Engelle
-- Bu sayede farklı şirketlerde aynı sicil numaraları olabilir ama aynı şirkette olamaz.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_company_employee_no_per_tenant'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT unique_company_employee_no_per_tenant UNIQUE (tenant_id, company_employee_no);
    END IF;
END $$;
