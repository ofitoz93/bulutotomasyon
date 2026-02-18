-- Aynı isimde şirket oluşturulmasını engelle
ALTER TABLE public.companies ADD CONSTRAINT companies_name_unique UNIQUE (name);
