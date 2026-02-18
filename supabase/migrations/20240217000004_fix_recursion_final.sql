-- RLS Sonsuz Döngü Sorunu İçin KESİN VE NİHAİ ÇÖZÜM
-- Bu script mevcut tüm politikaları temizler ve güvenli (recursion-free) yapıyı kurar.

-- 1. Önce eski/hatalı fonksiyonları ve politikaları temizleyelim
DROP POLICY IF EXISTS "Sistem yöneticileri tüm şirketleri görebilir" ON public.companies;
DROP POLICY IF EXISTS "Sistem yöneticileri şirket ekleyebilir" ON public.companies;
DROP POLICY IF EXISTS "Şirket yöneticileri kendi şirketlerini görebilir" ON public.companies;

DROP POLICY IF EXISTS "Sistem yöneticileri tüm profilleri görebilir" ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcılar kendi profillerini görebilir" ON public.profiles;
DROP POLICY IF EXISTS "Şirket yöneticileri şirketlerindeki profilleri görebilir" ON public.profiles;

DROP POLICY IF EXISTS "Sistem yöneticileri şirket modüllerini yönetebilir" ON public.company_modules;
DROP POLICY IF EXISTS "Şirket yöneticileri kendi modüllerini görebilir" ON public.company_modules;

-- Fonksiyonları düşür (Bağımlılık hatası verirse CASCADE kullanırız ama triggerlar vs. gidebilir, o yüzden REPLACE tercih ediyoruz)
-- Ancak temiz başlangıç için yardımcı fonksiyonları silip oluşturmak daha iyi.

-- 2. Güvenli Yardımcı Fonksiyonlar (Kesinlikle RLS Kapalı)
-- Bu fonksiyonlar tabloları okurken ASLA politika kontrolü yapmaz.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER -- Fonksiyonu oluşturanın (postgres/admin) yetkisiyle çalışır
SET search_path = public
SET row_security = off -- KİLİT NOKTA: RLS'yi kapatır
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  -- Direkt sorgu, politika takılmaz
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role;
END;
$$;

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

-- Ana Admin Kontrolü (Artık tablo okumaz, üstteki güvenli fonksiyonu çağırır)
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

-- 3. Politikaları GÜVENLİ fonksiyonlarla tekrar oluşturuyoruz

-- COMPANIES
CREATE POLICY "Sistem yöneticileri tüm şirketleri görebilir" ON public.companies
    FOR SELECT USING (public.is_system_admin());

CREATE POLICY "Sistem yöneticileri şirket ekleyebilir" ON public.companies
    FOR INSERT WITH CHECK (public.is_system_admin());

CREATE POLICY "Şirket yöneticileri kendi şirketlerini görebilir" ON public.companies
    FOR SELECT USING (id = public.get_my_tenant_id());

-- PROFILES
CREATE POLICY "Sistem yöneticileri tüm profilleri görebilir" ON public.profiles
    FOR SELECT USING (public.is_system_admin());

-- Kendini görme kuralı recursion yaratmaz (auth.uid() = id), ama yine de basit tutalım.
CREATE POLICY "Kullanıcılar kendi profillerini görebilir" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Şirket yöneticisi kuralı ESKİDEN RECURSION YARATIYORDU. Artık güvenli fonksiyon kullanıyor.
CREATE POLICY "Şirket yöneticileri şirketlerindeki profilleri görebilir" ON public.profiles
    FOR SELECT USING (
        public.get_my_role() = 'company_manager' 
        AND tenant_id = public.get_my_tenant_id()
    );

-- COMPANY MODULES
CREATE POLICY "Sistem yöneticileri şirket modüllerini yönetebilir" ON public.company_modules
    FOR ALL USING (public.is_system_admin());

CREATE POLICY "Şirket yöneticileri kendi modüllerini görebilir" ON public.company_modules
    FOR SELECT USING (company_id = public.get_my_tenant_id());

-- Admin Update İzni (Eksik olabilir, ekleyelim)
CREATE POLICY "Sistem yöneticileri profilleri güncelleyebilir" ON public.profiles
    FOR UPDATE USING (public.is_system_admin());

