-- =============================================
-- İŞ İZNİ ONAY MERCİLERİ (ESNEK YAPI GÜNCELLEMESİ)
-- =============================================

-- 1. Tablo Yapısını Esnekleştirelim
ALTER TABLE public.work_permit_approvers DROP CONSTRAINT IF EXISTS work_permit_approvers_tenant_id_user_id_role_type_key;

ALTER TABLE public.work_permit_approvers ALTER COLUMN user_id DROP NOT NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_permit_approvers' AND column_name='org_role_id') THEN
        ALTER TABLE public.work_permit_approvers ADD COLUMN org_role_id UUID REFERENCES public.org_roles(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_permit_approvers' AND column_name='department_id') THEN
        ALTER TABLE public.work_permit_approvers ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_permit_approvers' AND column_name='include_sub_departments') THEN
        ALTER TABLE public.work_permit_approvers ADD COLUMN include_sub_departments BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 'user_id', 'org_role_id' veya 'department_id' sütunlarından DİKKAT: tam olarak 1 tanesi dolu olmalı.
ALTER TABLE public.work_permit_approvers DROP CONSTRAINT IF EXISTS enforce_single_assignment_type;
ALTER TABLE public.work_permit_approvers ADD CONSTRAINT enforce_single_assignment_type CHECK (
    (user_id IS NOT NULL)::integer + 
    (org_role_id IS NOT NULL)::integer + 
    (department_id IS NOT NULL)::integer = 1
);


-- =============================================
-- 2. Yetki Kontrol Fonksiyonu (RPC)
-- =============================================
-- Bu fonksiyon, mevcut kullanıcının (auth.uid()) ilgili tenant_id için 
-- 'engineer' mi yoksa 'isg' yetkisine mi sahip olduğunu kontrol eder.
-- Geri dönüş: Sahip olduğu rolleri tablo olarak döndürür (0, 1 veya 2 satır).

CREATE OR REPLACE FUNCTION public.get_my_permit_approval_roles(p_tenant_id UUID)
RETURNS TABLE (role_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_my_departments UUID[];
    v_my_roles UUID[];
BEGIN
    -- Kullanıcının departman ve rol bilgisini alalım (Bir kişi birden fazla rolde/departmanda olabilir)
    -- O yüzden INTO ile tek değişkene atmak yerine IN() clause'u ile veya dizi (array) ile kontrol etmeliyiz.
    -- Bu senaryoda departman ve rolleri temp array'lere atalım:
    
    -- SELECT array_agg() can return NULL if no rows match. We must COALESCE to empty array '{}' 
    -- otherwise ANY(NULL) will evaluate to NULL (falsy) and break the OR chain.
    SELECT COALESCE(array_agg(department_id), '{}'::uuid[]) INTO v_my_departments FROM public.department_members WHERE tenant_id = p_tenant_id AND user_id = v_user_id;
    SELECT COALESCE(array_agg(role_id), '{}'::uuid[]) INTO v_my_roles FROM public.department_members WHERE tenant_id = p_tenant_id AND user_id = v_user_id AND role_id IS NOT NULL;

    RETURN QUERY
    WITH RECURSIVE RecursiveHierarchy AS (
        -- Recursive sorgu: Kullanıcının departmanından başlayıp üst departmanlara doğru çıkarak
        -- o departman için 'include_sub_departments' = true olan yetkileri arayacağız.
        SELECT 
            id as dep_id, 
            parent_id 
        FROM public.departments 
        WHERE id = ANY(v_my_departments)

        UNION ALL

        SELECT 
            d.id, 
            d.parent_id
        FROM public.departments d
        JOIN RecursiveHierarchy rh ON d.id = rh.parent_id
    )
    SELECT DISTINCT wpa.role_type::TEXT
    FROM public.work_permit_approvers wpa
    WHERE wpa.tenant_id = p_tenant_id
    AND (
        -- 1. Durum: Doğrudan kullanıcıya verilmiş yetki
        wpa.user_id = v_user_id
        OR
        -- 2. Durum: Kullanıcının organizasyon rolüne (Tüm Mühendisler vb.) verilmiş yetki
        (wpa.org_role_id IS NOT NULL AND wpa.org_role_id = ANY(v_my_roles))
        OR
        -- 3. Durum: Kullanıcının DOĞRUDAN bağlı olduğu departmana verilmiş yetki
        (wpa.department_id IS NOT NULL AND wpa.department_id = ANY(v_my_departments) AND wpa.include_sub_departments = false)
        OR
        -- 4. Durum: Kullanıcının departmanına VEYA üst departmanlarına verilmiş ve "alt departmanlar dahil" denmiş yetki
        (
            wpa.department_id IS NOT NULL 
            AND wpa.include_sub_departments = true 
            AND wpa.department_id IN (SELECT dep_id FROM RecursiveHierarchy)
        )
    );
END;
$$;


-- =============================================
-- 3. ANA TABLO (work_permits) RLS GÜNCELLEMESİ
-- =============================================
-- Önceden sadece tabloya (work_permit_approvers) direkt user_id ile bakıyordu.
-- Artık yazdığımız esnek fonksiyonu kullanacağız.

DROP POLICY IF EXISTS "İş İznini Güncelleme" ON public.work_permits;

CREATE POLICY "İş İznini Güncelleme" ON public.work_permits
    FOR UPDATE USING (
        tenant_id = public.get_my_tenant_id() AND 
        (
            -- İşlemi yapan kişi izin sahibi
            auth.uid() = created_by 
            OR 
            -- Veya şirket yöneticisi
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'company_manager')
            OR
            -- Veya bu modülde bir onaycı yetkisine sahipse (Yeni fonksiyonumuz)
            EXISTS (SELECT 1 FROM public.get_my_permit_approval_roles(public.get_my_tenant_id()))
        )
    );

-- NOTIFY PostgREST
NOTIFY pgrst, 'reload schema';
