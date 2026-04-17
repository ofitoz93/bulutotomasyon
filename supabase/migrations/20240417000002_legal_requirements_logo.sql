-- Companies tablosuna yasal şartlar modülü için logo sütunu ekle
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS legal_logo_url TEXT;

-- Gerekli politikalar ve izinler (Zaten initial schema ile verilmiş olabilir ama garantiye alalım)
-- Şirket yöneticilerinin kendi şirket bilgilerini güncelleyebilmesi için (Logo dahil)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'companies' AND policyname = 'Şirket yöneticileri kendi şirketini güncelleyebilir'
    ) THEN
        CREATE POLICY "Şirket yöneticileri kendi şirketini güncelleyebilir" ON public.companies
            FOR UPDATE
            TO authenticated
            USING (id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
            WITH CHECK (id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;
