-- =============================================
-- EVRAK TAKİP MODÜLÜ - VERİTABANI TABLOLARI
-- =============================================

-- 1. Belge Türleri (Kullanıcıya özel)
CREATE TABLE IF NOT EXISTS public.document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Lokasyonlar (Kullanıcıya özel)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Belgeler (Documents)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('kurumsal', 'sahsi')),
    document_type_id UUID REFERENCES public.document_types(id),
    location_id UUID REFERENCES public.locations(id),
    title TEXT,
    acquisition_date DATE NOT NULL,
    is_indefinite BOOLEAN DEFAULT false,
    expiry_date DATE,
    application_deadline DATE,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    reminder_days_before INTEGER DEFAULT 5,
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS'i devre dışı bırak (geliştirme aşamasında, disable_rls migration'ına uygun)
ALTER TABLE public.document_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;

-- Storage bucket (SQL ile oluşturulamaz, Supabase Dashboard'dan yapılmalı)
-- NOT: 'documents' adında bir storage bucket oluşturun ve 5MB limit ayarlayın.
