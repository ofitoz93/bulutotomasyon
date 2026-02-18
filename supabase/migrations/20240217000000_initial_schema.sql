-- Özel tipleri oluştur
CREATE TYPE public.user_role AS ENUM ('system_admin', 'company_manager', 'employee');

-- Şirketler (Companies) tablosunu oluştur
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subscription_status TEXT DEFAULT 'active', -- Abonelik durumu: aktif, pasif vb.
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Şirketler tablosunda RLS (Satır Düzeyinde Güvenlik) etkinleştir
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Profiller (Profiles) tablosunu oluştur (Aşağıdaki politikalar tarafından referans verilir)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role public.user_role NOT NULL DEFAULT 'employee',
    tenant_id UUID REFERENCES public.companies(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Profiller tablosunda RLS etkinleştir
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Admin kontrolü yaparken RLS özyinelemesini (recursion) önlemek için Güvenlik Tanımlayıcı (Security Definer) Fonksiyonu
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'system_admin'
  );
END;
$$;

-- Şirketler (Companies) politikaları
CREATE POLICY "Sistem yöneticileri tüm şirketleri görebilir" ON public.companies
    FOR SELECT
    USING (public.is_system_admin());

CREATE POLICY "Sistem yöneticileri şirket ekleyebilir" ON public.companies
    FOR INSERT
    WITH CHECK (public.is_system_admin());

CREATE POLICY "Şirket yöneticileri kendi şirketlerini görebilir" ON public.companies
    FOR SELECT
    USING (
        id IN (
            SELECT tenant_id FROM public.profiles
            WHERE profiles.id = auth.uid()
        )
    );

-- Profiller (Profiles) politikaları
CREATE POLICY "Sistem yöneticileri tüm profilleri görebilir" ON public.profiles
    FOR SELECT
    USING (public.is_system_admin());

CREATE POLICY "Kullanıcılar kendi profillerini görebilir" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Şirket yöneticileri şirketlerindeki profilleri görebilir" ON public.profiles
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'company_manager'
        )
    );

-- Modüller (Modules) tablosunu oluştur
CREATE TABLE public.modules (
    key TEXT PRIMARY KEY, -- örn: 'evrak_takip', 'ik'
    name TEXT NOT NULL,
    description TEXT
);

-- Modüller tablosunda RLS etkinleştir
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- Herkes modül tanımlarını görebilir (Sistemsel tanım oldukları için)
CREATE POLICY "Doğrulanmış kullanıcılar modülleri görebilir" ON public.modules
    FOR SELECT
    TO authenticated
    USING (true);

-- Şirket Modülleri (Company Modules) tablosunu oluştur
CREATE TABLE public.company_modules (
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    module_key TEXT REFERENCES public.modules(key) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (company_id, module_key)
);

-- Şirket Modülleri tablosunda RLS etkinleştir
ALTER TABLE public.company_modules ENABLE ROW LEVEL SECURITY;

-- Sistem yöneticileri şirket modüllerini yönetebilir
CREATE POLICY "Sistem yöneticileri şirket modüllerini yönetebilir" ON public.company_modules
    FOR ALL
    USING (public.is_system_admin());

-- Şirket yöneticileri kendi aktif modüllerini görebilir
CREATE POLICY "Şirket yöneticileri kendi modüllerini görebilir" ON public.company_modules
    FOR SELECT
    USING (
        company_id IN (
            SELECT tenant_id FROM public.profiles
            WHERE profiles.id = auth.uid()
        )
    );
