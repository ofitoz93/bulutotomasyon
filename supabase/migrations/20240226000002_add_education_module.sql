-- Migration: 20240226000002_add_education_module.sql
-- Description: Adds Education module to the modules table

INSERT INTO public.modules (key, name, description, category)
VALUES ('education', 'Eğitim Modülü', 'Çalışanların eğitim ve sınav süreçlerinin yönetimi.', 'Personel Yönetimi')
ON CONFLICT (key) DO NOTHING;
