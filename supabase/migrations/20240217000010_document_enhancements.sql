-- =============================================
-- EVRAK TAKİP MODÜLÜ - GELİŞTİRMELER
-- =============================================

-- 1. Kullanıcı bazlı modül erişimi
CREATE TABLE IF NOT EXISTS public.user_module_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL REFERENCES public.modules(key) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, module_key, tenant_id)
);

ALTER TABLE public.user_module_access DISABLE ROW LEVEL SECURITY;

-- 2. Belgelere arşiv alanı ekle
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS renewed_from UUID REFERENCES public.documents(id);

-- 3. Mükerrer belge engelleme (aynı tür + lokasyon + şirket, aktif belgeler için)
-- Bu kontrolü frontend'de yapacağız, çünkü arşivlenmiş belgeler aynı olabilir.

-- 4. E-posta hatırlatma fonksiyonu (pg_cron ile günde 1 çalıştırılır)
CREATE OR REPLACE FUNCTION public.check_document_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    doc RECORD;
    target_date DATE;
    days_left INTEGER;
    user_email TEXT;
BEGIN
    FOR doc IN
        SELECT d.*, p.email
        FROM public.documents d
        JOIN public.profiles p ON p.id = d.user_id
        WHERE d.is_archived = false
          AND d.is_indefinite = false
          AND d.reminder_sent = false
          AND d.reminder_days_before IS NOT NULL
    LOOP
        -- Hedef tarih: son başvuru varsa o, yoksa bitiş tarihi
        target_date := COALESCE(doc.application_deadline, doc.expiry_date);

        IF target_date IS NOT NULL THEN
            days_left := target_date - CURRENT_DATE;

            -- Hatırlatma gün sayısına ulaşıldıysa veya geçildiyse
            IF days_left <= doc.reminder_days_before THEN
                -- reminder_sent flag'ini güncelle (günde 1 kere)
                UPDATE public.documents
                SET reminder_sent = true
                WHERE id = doc.id;

                -- NOT: Gerçek e-posta gönderimi için Edge Function veya
                -- harici servis kullanılmalıdır. Bu fonksiyon sadece
                -- flag'leri günceller.
            END IF;
        END IF;
    END LOOP;
END;
$$;
