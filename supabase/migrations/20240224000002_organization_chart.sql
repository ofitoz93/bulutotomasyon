-- =============================================
-- ORGANİZASYON ŞEMASI (ORGANIZATION CHART) MODÜLÜ
-- =============================================

-- 1. Modül Tanımlaması
INSERT INTO public.modules (key, name, description)
VALUES ('org_chart', 'Organizasyon Şeması', 'Şirket içi departman, unvan ve organizasyon hiyerarşisi yönetimi')
ON CONFLICT (key) DO NOTHING;

-- 2. Departmanlar (Departments)
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES public.departments(id) ON DELETE CASCADE, -- Hiyerarşi için
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Organizasyon Rolleri / Unvanlar (Org Roles)
CREATE TABLE public.org_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Örn: Müdür, Şef, İnsan Kaynakları Uzmanı
    level_weight INTEGER DEFAULT 0, -- Şemada kime üst kime alt olacağını görselleştirmek için (sayı ne kadar büyükse o kadar üst, opsiyonel kurgu)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Departman Üyeleri (Atamalar)
CREATE TABLE public.department_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.org_roles(id) ON DELETE SET NULL,
    is_manager BOOLEAN DEFAULT false, -- Departmanın yöneticisi (manager) olup olmadığını belirten kısa yol bayrağı
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(department_id, user_id) -- Bir kullanıcı aynı departmana birden fazla kez atanmasın (rol değişirse update edilir)
);

-- =============================================
-- RLS (ROW LEVEL SECURITY) POLİTİKALARI
-- =============================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;

-- Politikalar: Sisteme dahil edilmiş tüm çalışanlar şemayı "görebilir"
CREATE POLICY "Kullanıcılar şirketlerindeki departmanları görebilir" ON public.departments
    FOR SELECT USING ( tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()) );

CREATE POLICY "Kullanıcılar şirketlerindeki unvanları görebilir" ON public.org_roles
    FOR SELECT USING ( tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()) );

CREATE POLICY "Kullanıcılar şirketlerindeki atamaları görebilir" ON public.department_members
    FOR SELECT USING ( tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()) );

-- Politikalar: Tam Yetki (INSERT/UPDATE/DELETE) Sadece Şirket Yöneticisinde (Company Manager) ve Sistem Yöneticisinde

-- 1. Departments Full Access
CREATE POLICY "Yöneticiler departmanları yönetebilir" ON public.departments
    FOR ALL USING (
        public.is_system_admin() OR 
        tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'company_manager')
    );

-- 2. Org Roles Full Access
CREATE POLICY "Yöneticiler unvanları yönetebilir" ON public.org_roles
    FOR ALL USING (
        public.is_system_admin() OR 
        tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'company_manager')
    );

-- 3. Department Members Full Access
CREATE POLICY "Yöneticiler yetkilendirmeleri yönetebilir" ON public.department_members
    FOR ALL USING (
        public.is_system_admin() OR 
        tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'company_manager')
    );
