-- 1. Aksiyon Takip Modülünü Sisteme Ekle
INSERT INTO public.modules (key, name, description)
VALUES ('aksiyon_takip', 'Aksiyon Takip Sistemi', 'Kişilere, departmanlara veya firmalara aksiyon (görev/düzeltici faaliyet) atama ve takip etme sistemi.')
ON CONFLICT (key) DO NOTHING;

-- 2. Konfigürasyon Tabloları
CREATE TABLE IF NOT EXISTS public.action_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.action_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.action_contractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Ana Aksiyon Tablosu
CREATE TABLE IF NOT EXISTS public.actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    tracking_number TEXT, -- ACT-2024-001 (Otomatik Üretilecek)
    subject_id UUID NOT NULL REFERENCES public.action_subjects(id),
    project_id UUID NOT NULL REFERENCES public.action_projects(id),
    total_days INT NOT NULL,
    action_description TEXT NOT NULL,
    nonconformity_description TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- 'open', 'closed'
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES public.profiles(id)
);

-- Takip Numarası Sıra Tutucu Tablosu
CREATE TABLE IF NOT EXISTS public.company_action_sequences (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    last_val INT DEFAULT 0
);

-- 4. Atama ve Bilgi Tabloları
CREATE TABLE IF NOT EXISTS public.action_assignee_users (
    action_id UUID NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (action_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.action_assignee_contractors (
    action_id UUID NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES public.action_contractors(id) ON DELETE CASCADE,
    PRIMARY KEY (action_id, contractor_id)
);

CREATE TABLE IF NOT EXISTS public.action_assignee_external (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
    email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.action_cc_users (
    action_id UUID NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (action_id, user_id)
);

-- 5. Yorum ve Dosya Tabloları
CREATE TABLE IF NOT EXISTS public.action_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.action_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
    file_url TEXT NOT NULL,
    file_name TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Otomatik Takip Numarası Trigger'ı
CREATE OR REPLACE FUNCTION generate_action_tracking_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_val INT;
    year_str TEXT;
BEGIN
    -- Ensure sequence row exists
    INSERT INTO public.company_action_sequences (company_id, last_val)
    VALUES (NEW.company_id, 0)
    ON CONFLICT (company_id) DO NOTHING;
    
    -- Increment and get sequence
    UPDATE public.company_action_sequences
    SET last_val = last_val + 1
    WHERE company_id = NEW.company_id
    RETURNING last_val INTO seq_val;
    
    year_str := TO_CHAR(now(), 'YYYY');
    -- Format: ACT-YYYY-001 (ACT-2024-001 vb.)
    NEW.tracking_number := 'ACT-' || year_str || '-' || LPAD(seq_val::text, 3, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS action_tracking_number_trigger ON public.actions;
CREATE TRIGGER action_tracking_number_trigger
BEFORE INSERT ON public.actions
FOR EACH ROW
EXECUTE FUNCTION generate_action_tracking_number();

-- 7. RLS Aktifleştirme ve Politikalar
ALTER TABLE public.action_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_action_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_assignee_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_assignee_contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_assignee_external ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_cc_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_files ENABLE ROW LEVEL SECURITY;

-- Politikalar: Herkes sadece kendi şirketinin verilerini görebilir
CREATE POLICY "Aksiyon Konularını Görme" ON public.action_subjects FOR SELECT USING (company_id = public.get_my_tenant_id());
CREATE POLICY "Aksiyon Konusu Ekleme" ON public.action_subjects FOR INSERT WITH CHECK (company_id = public.get_my_tenant_id());
CREATE POLICY "Aksiyon Konusu Düzenleme" ON public.action_subjects FOR UPDATE USING (company_id = public.get_my_tenant_id());
CREATE POLICY "Aksiyon Konusu Silme" ON public.action_subjects FOR DELETE USING (company_id = public.get_my_tenant_id());

CREATE POLICY "Aksiyon Projelerini Görme" ON public.action_projects FOR SELECT USING (company_id = public.get_my_tenant_id());
CREATE POLICY "Aksiyon Projesi Ekleme" ON public.action_projects FOR INSERT WITH CHECK (company_id = public.get_my_tenant_id());
CREATE POLICY "Aksiyon Projesi Düzenleme" ON public.action_projects FOR UPDATE USING (company_id = public.get_my_tenant_id());
CREATE POLICY "Aksiyon Projesi Silme" ON public.action_projects FOR DELETE USING (company_id = public.get_my_tenant_id());

CREATE POLICY "Aksiyon Firmalarını Görme" ON public.action_contractors FOR SELECT USING (company_id = public.get_my_tenant_id());
CREATE POLICY "Aksiyon Firması Ekleme" ON public.action_contractors FOR INSERT WITH CHECK (company_id = public.get_my_tenant_id());
CREATE POLICY "Aksiyon Firması Düzenleme" ON public.action_contractors FOR UPDATE USING (company_id = public.get_my_tenant_id());
CREATE POLICY "Aksiyon Firması Silme" ON public.action_contractors FOR DELETE USING (company_id = public.get_my_tenant_id());

CREATE POLICY "Aksiyonları Görme" ON public.actions FOR SELECT USING (company_id = public.get_my_tenant_id());
CREATE POLICY "Aksiyon Ekleme" ON public.actions FOR INSERT WITH CHECK (company_id = public.get_my_tenant_id());
-- Sadece oluşturan kişi VEYA company_manager silebilir/güncelleyebilir
CREATE POLICY "Aksiyon Güncelleme/Kapatma" ON public.actions FOR UPDATE USING (
    company_id = public.get_my_tenant_id() AND 
    (auth.uid() = created_by OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'company_manager'))
);
CREATE POLICY "Aksiyon Silme" ON public.actions FOR DELETE USING (
    company_id = public.get_my_tenant_id() AND 
    (auth.uid() = created_by OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'company_manager'))
);

CREATE POLICY "Atanan Personeli Görme" ON public.action_assignee_users FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);
CREATE POLICY "Atanan Personel Ekleme" ON public.action_assignee_users FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);
CREATE POLICY "Atanan Personel Silme" ON public.action_assignee_users FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);

CREATE POLICY "Atanan Firmayı Görme" ON public.action_assignee_contractors FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);
CREATE POLICY "Atanan Firma Ekleme" ON public.action_assignee_contractors FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);
CREATE POLICY "Atanan Firma Silme" ON public.action_assignee_contractors FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);

CREATE POLICY "Harici Atananı Görme" ON public.action_assignee_external FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);
CREATE POLICY "Harici Atanan Ekleme" ON public.action_assignee_external FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);
CREATE POLICY "Harici Atanan Silme" ON public.action_assignee_external FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);

CREATE POLICY "CC Personeli Görme" ON public.action_cc_users FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);
CREATE POLICY "CC Personel Ekleme" ON public.action_cc_users FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);
CREATE POLICY "CC Personel Silme" ON public.action_cc_users FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);

CREATE POLICY "Yorumları Görme" ON public.action_comments FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);
CREATE POLICY "Yorum Ekleme" ON public.action_comments FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);

CREATE POLICY "Dosyaları Görme" ON public.action_files FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);
CREATE POLICY "Dosya Ekleme" ON public.action_files FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.actions WHERE id = action_id AND company_id = public.get_my_tenant_id())
);

-- 8. Storage Bucketi Oluşturma ve Kuralları
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('action-files', 'action-files', true, 10485760) -- 10MB limit
ON CONFLICT (id) DO 
UPDATE SET file_size_limit = 10485760;

DROP POLICY IF EXISTS "Aksiyon Dosyaları Ekleme" ON storage.objects;
DROP POLICY IF EXISTS "Aksiyon Dosyaları Görme" ON storage.objects;

CREATE POLICY "Aksiyon Dosyaları Ekleme" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'action-files');
CREATE POLICY "Aksiyon Dosyaları Görme" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'action-files');

NOTIFY pgrst, 'reload schema';
