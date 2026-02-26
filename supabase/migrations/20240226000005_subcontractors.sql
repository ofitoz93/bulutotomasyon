-- =============================================
-- ALT TAŞERON (SUBCONTRACTOR) MODÜLÜ
-- =============================================

-- 1. user_role ENUM'una 'subcontractor_manager' değeri ekle
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'subcontractor_manager';

-- 2. Alt Taşeron Modülünü Sisteme Tanımla
INSERT INTO public.modules (key, name, description)
VALUES ('alt_taseron', 'Alt Taşeron Yönetimi', 'Şirketlere bağlı alt taşeron firmalarını yönetme, davet etme ve modül erişimi tanımlama.')
ON CONFLICT (key) DO NOTHING;

-- 3. Alt Taşeronlar (Subcontractors) Tablosu
CREATE TABLE IF NOT EXISTS public.subcontractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. work_permits tablosuna subcontractor_id kolonu ekle
ALTER TABLE public.work_permits ADD COLUMN IF NOT EXISTS subcontractor_id UUID REFERENCES public.subcontractors(id) ON DELETE SET NULL;

-- 5. RLS Etkinleştirme
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

-- 6. RLS Politikaları

-- Sistem yöneticileri tüm alt taşeronları görebilir
CREATE POLICY "Sistem yöneticileri tüm alt taşeronları görebilir"
ON public.subcontractors FOR SELECT
USING (public.is_system_admin());

-- Şirket yöneticileri kendi şirketlerinin alt taşeronlarını görebilir
CREATE POLICY "Şirket yöneticileri kendi taşeronlarını görebilir"
ON public.subcontractors FOR SELECT
USING (parent_company_id = public.get_my_tenant_id());

-- Şirket yöneticileri alt taşeron ekleyebilir
CREATE POLICY "Şirket yöneticileri taşeron ekleyebilir"
ON public.subcontractors FOR INSERT
WITH CHECK (
    parent_company_id = public.get_my_tenant_id()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'company_manager')
);

-- Şirket yöneticileri kendi taşeronlarını güncelleyebilir
CREATE POLICY "Şirket yöneticileri taşeron güncelleyebilir"
ON public.subcontractors FOR UPDATE
USING (
    parent_company_id = public.get_my_tenant_id()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'company_manager')
);

-- Şirket yöneticileri kendi taşeronlarını silebilir
CREATE POLICY "Şirket yöneticileri taşeron silebilir"
ON public.subcontractors FOR DELETE
USING (
    parent_company_id = public.get_my_tenant_id()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'company_manager')
);

-- Alt taşeron yöneticisi kendi kaydını görebilir
CREATE POLICY "Taşeron yöneticisi kendi kaydını görebilir"
ON public.subcontractors FOR SELECT
USING (user_id = auth.uid());

-- 7. Admin tarafından oluşturulan kullanıcıların e-postasını otomatik onaylayan fonksiyon
-- Bu fonksiyon SECURITY DEFINER olduğu için auth.users tablosuna erişebilir
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE auth.users
    SET email_confirmed_at = now(),
        confirmed_at = now(),
        updated_at = now()
    WHERE id = user_id
    AND email_confirmed_at IS NULL;
END;
$$;

-- 8. E-posta Bildirim Kuyruğu Tablosu
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, sent, failed
    created_at TIMESTAMPTZ DEFAULT now(),
    sent_at TIMESTAMPTZ
);

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bildirim kuyruğu yönetimi" ON public.notification_queue FOR ALL USING (public.is_system_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'company_manager'));
CREATE POLICY "Bildirim kuyruğuna ekleme" ON public.notification_queue FOR INSERT TO authenticated WITH CHECK (true);

-- 9. Aksiyon bildirim e-postası gönderme fonksiyonu
-- Bu fonksiyon e-posta içeriğini notification_queue tablosuna kaydeder
-- ve pg_net ile Supabase Edge Function'ı çağırarak gönderim yapar
CREATE OR REPLACE FUNCTION public.send_action_notification_email(
    p_to_email TEXT,
    p_firm_name TEXT,
    p_tracking_number TEXT,
    p_action_description TEXT,
    p_nonconformity_description TEXT,
    p_total_days INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subject TEXT;
    v_body TEXT;
BEGIN
    v_subject := 'Yeni Aksiyon Bildirimi - ' || p_tracking_number;
    v_body := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">'
        || '<div style="background-color:#1e293b;padding:24px;text-align:center;">'
        || '<h1 style="color:#fff;margin:0;font-size:22px;">Aksiyon Bildirimi</h1>'
        || '</div>'
        || '<div style="padding:32px;background:#fff;">'
        || '<p style="font-size:16px;color:#334155;">Sayın <strong>' || p_firm_name || '</strong>,</p>'
        || '<p style="font-size:14px;color:#64748b;">Firmanıza aşağıdaki aksiyon açılmıştır. Lütfen belirtilen süre içinde gereğini yapınız.</p>'
        || '<div style="background:#f1f5f9;padding:16px;border-radius:6px;margin:20px 0;">'
        || '<p style="margin:0 0 8px;font-size:13px;color:#64748b;">Takip No:</p>'
        || '<p style="margin:0;font-size:18px;font-weight:bold;color:#0f172a;">' || p_tracking_number || '</p>'
        || '</div>'
        || '<div style="margin:16px 0;">'
        || '<p style="font-size:13px;color:#64748b;margin-bottom:4px;">Tespit Edilen Uygunsuzluk:</p>'
        || '<p style="font-size:14px;color:#0f172a;background:#fef3c7;padding:12px;border-radius:6px;">' || p_nonconformity_description || '</p>'
        || '</div>'
        || '<div style="margin:16px 0;">'
        || '<p style="font-size:13px;color:#64748b;margin-bottom:4px;">Alınacak Aksiyon:</p>'
        || '<p style="font-size:14px;color:#0f172a;background:#dcfce7;padding:12px;border-radius:6px;">' || p_action_description || '</p>'
        || '</div>'
        || '<div style="background:#dbeafe;padding:12px;border-radius:6px;text-align:center;margin:20px 0;">'
        || '<p style="margin:0;font-size:14px;color:#1e40af;">Teslim Süresi: <strong>' || p_total_days || ' gün</strong></p>'
        || '</div>'
        || '<p style="font-size:12px;color:#94a3b8;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">Bu e-posta otomatik olarak gönderilmiştir.</p>'
        || '</div></div>';

    -- Kuyruğa ekle
    INSERT INTO public.notification_queue (to_email, subject, body_html, status)
    VALUES (p_to_email, v_subject, v_body, 'pending');
END;
$$;

NOTIFY pgrst, 'reload schema';
