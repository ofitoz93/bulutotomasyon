-- =============================================
-- EVRAK TAKİP MODÜLÜ - YETKİLENDİRME (AUTHORIZATION)
-- =============================================

CREATE TABLE IF NOT EXISTS public.document_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    can_view_all_corporate BOOLEAN DEFAULT false,
    can_edit_all_corporate BOOLEAN DEFAULT false,
    can_delete_all_corporate BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tenant_id)
);

-- RLS'i devre dışı bırak (projedeki diğer tablolar gibi)
ALTER TABLE public.document_permissions DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
