-- user_module_access tablosunda RLS etkinleştir
ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;

-- Sistem yöneticileri her şeyi yapabilir
CREATE POLICY "Sistem yöneticileri tüm yetkileri yönetebilir" ON public.user_module_access
    FOR ALL
    USING (public.is_system_admin());

-- Şirket yöneticileri kendi şirketlerindeki personellerin yetkilerini görebilir
CREATE POLICY "Şirket yöneticileri yetkileri görebilir" ON public.user_module_access
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'company_manager'
        )
    );

-- Şirket yöneticileri kendi şirketlerindeki personellere yetki verebilir/silebilir
CREATE POLICY "Şirket yöneticileri yetki atayabilir" ON public.user_module_access
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'company_manager'
        )
    );

CREATE POLICY "Şirket yöneticileri yetki silebilir" ON public.user_module_access
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'company_manager'
        )
    );

-- Kullanıcılar kendi yetkilerini görebilir
CREATE POLICY "Kullanıcılar kendi yetkilerini görebilir" ON public.user_module_access
    FOR SELECT
    USING (user_id = auth.uid());
