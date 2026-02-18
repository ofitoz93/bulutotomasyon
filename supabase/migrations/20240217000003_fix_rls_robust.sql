-- RLS Sonsuz Döngü Sorunu İçin Kesin Çözüm Paketi

-- 1. Güvenli Rol Getirme Fonksiyonu (RLS Bypassed)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role;
END;
$$;

-- 2. Güvenli Tenant ID Getirme Fonksiyonu (RLS Bypassed)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
  RETURN v_tenant_id;
END;
$$;

-- 3. is_system_admin Güncellemesi (Yeni fonksiyonu kullanır)
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN (public.get_my_role() = 'system_admin');
END;
$$;

-- 4. HATALI POLİTİKALARI KALDIR VE GÜVENLİ OLANLARLA DEĞİŞTİR

-- Companies: Şirket Yöneticisi Görüşü
DROP POLICY IF EXISTS "Şirket yöneticileri kendi şirketlerini görebilir" ON public.companies;
CREATE POLICY "Şirket yöneticileri kendi şirketlerini görebilir" ON public.companies
    FOR SELECT
    USING (id = public.get_my_tenant_id());

-- Profiles: Şirket Yöneticisi Görüşü
DROP POLICY IF EXISTS "Şirket yöneticileri şirketlerindeki profilleri görebilir" ON public.profiles;
CREATE POLICY "Şirket yöneticileri şirketlerindeki profilleri görebilir" ON public.profiles
    FOR SELECT
    USING (
        public.get_my_role() = 'company_manager' 
        AND tenant_id = public.get_my_tenant_id()
    );

-- Company Modules: Şirket Yöneticisi Görüşü
DROP POLICY IF EXISTS "Şirket yöneticileri kendi modüllerini görebilir" ON public.company_modules;
CREATE POLICY "Şirket yöneticileri kendi modüllerini görebilir" ON public.company_modules
    FOR SELECT
    USING (company_id = public.get_my_tenant_id());
