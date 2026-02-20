-- Modül Tanımını Ekle
INSERT INTO public.modules (key, name, description, category)
VALUES ('adr', 'ADR Yönetimi', 'Tehlikeli madde ve atık süreçlerinin yönetimi', 'Operasyon')
ON CONFLICT (key) DO NOTHING;

-- Mevcut Şirketlere Modülü Ekle (Aktif olarak)
INSERT INTO public.company_modules (company_id, module_key, is_active)
SELECT id, 'adr', true FROM public.companies
ON CONFLICT (company_id, module_key) DO NOTHING;
