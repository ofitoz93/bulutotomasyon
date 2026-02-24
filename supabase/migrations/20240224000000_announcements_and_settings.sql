-- 1. Add phone_number to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 2. Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE, -- NULL if created by system_admin
    is_global BOOLEAN DEFAULT false, -- True if intended for everyone under the creator's scope
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 3. Create announcement_targets table (for specific company/user routing)
CREATE TABLE IF NOT EXISTS public.announcement_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
    target_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE, -- For admin to target specific companies
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE      -- For manager to target specific employees
);

-- Enable RLS for announcement_targets
ALTER TABLE public.announcement_targets ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for announcements

-- System Admins can do anything with announcements
CREATE POLICY "Sistem yöneticileri tüm duyuruları yönetebilir" ON public.announcements
    FOR ALL
    USING (public.is_system_admin());

-- Company Managers can insert/delete announcements for their tenant
CREATE POLICY "Şirket yöneticileri kendi duyurularını ekleyebilir" ON public.announcements
    FOR INSERT
    WITH CHECK (
        public.get_my_role() = 'company_manager' 
        AND tenant_id = public.get_my_tenant_id()
    );

CREATE POLICY "Şirket yöneticileri kendi duyurularını silebilir" ON public.announcements
    FOR DELETE
    USING (
        public.get_my_role() = 'company_manager' 
        AND tenant_id = public.get_my_tenant_id()
    );

-- View Policy: 
-- Company Managers can view:
-- 1. Announcements in their own tenant (the ones they sent)
-- 2. Global announcements sent by admin (is_global=true, tenant_id is null)
-- 3. Targeted announcements sent by admin explicitly to their company
-- Employees can view:
-- 1. Global announcements sent by their manager (is_global=true, tenant_id matches)
-- 2. Targeted announcements sent to them explicitly
CREATE POLICY "Kullanıcılar yetkili oldukları duyuruları görebilir" ON public.announcements
    FOR SELECT
    USING (
        -- System admin can see everything (handled by the system admin policy, but just in case, we don't need it here)
        
        -- If I created it, I can see it
        created_by = auth.uid()
        
        OR
        -- Global admin announcements are visible to ALL company managers
        (tenant_id IS NULL AND is_global = true AND public.get_my_role() = 'company_manager')
        
        OR
        -- Company managers can see global announcements for their tenant
        (tenant_id = public.get_my_tenant_id() AND is_global = true)
        
        OR
        -- I am explicitly targeted via the targets table (admin to company OR manager to employee)
        -- Since the targets table policy now doesn't check announcements table permissions, this is safe from recursion.
        id IN (
            SELECT announcement_id FROM public.announcement_targets
            WHERE 
                (target_company_id = public.get_my_tenant_id() AND public.get_my_role() = 'company_manager')
                OR
                (target_user_id = auth.uid() AND public.get_my_role() = 'employee')
        )
    );

-- 5. RLS Policies for announcement_targets

-- System Admins can do anything with targets
CREATE POLICY "Sistem yöneticileri tüm hedefleri yönetebilir" ON public.announcement_targets
    FOR ALL
    USING (public.is_system_admin());

-- Company Managers can insert/delete targets for their announcements
CREATE POLICY "Şirket yöneticileri kendi duyuru hedeflerini ekleyebilir" ON public.announcement_targets
    FOR INSERT
    WITH CHECK (
        public.get_my_role() = 'company_manager' 
        AND announcement_id IN (
            SELECT id FROM public.announcements WHERE tenant_id = public.get_my_tenant_id()
        )
    );

CREATE POLICY "Şirket yöneticileri kendi duyuru hedeflerini silebilir" ON public.announcement_targets
    FOR DELETE
    USING (
        public.get_my_role() = 'company_manager' 
        AND announcement_id IN (
            SELECT id FROM public.announcements WHERE tenant_id = public.get_my_tenant_id()
        )
    );

-- View Policy for targets: Users can see the target if they can see the announcement (keep it simple)
CREATE POLICY "Kullanıcılar duyuru hedeflerini görebilir" ON public.announcement_targets
    FOR SELECT
    USING (
        -- To avoid infinite recursion with announcements table SELECT policy,
        -- we simplify this: you can see target records that apply to your company or you personally.
        -- System admins (via is_system_admin bypass) will see all anyway.
        target_company_id = public.get_my_tenant_id()
        OR target_user_id = auth.uid()
    );
