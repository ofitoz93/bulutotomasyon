-- Aksiyon Tablosuna deadline_date ve subcontractor_id ekle
ALTER TABLE public.actions ADD COLUMN IF NOT EXISTS deadline_date DATE;
ALTER TABLE public.actions ADD COLUMN IF NOT EXISTS subcontractor_id UUID REFERENCES public.subcontractors(id) ON DELETE SET NULL;

-- Deadline'ı otomatik hesaplayan trigger (total_days'den)
CREATE OR REPLACE FUNCTION public.set_action_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.deadline_date IS NULL AND NEW.total_days IS NOT NULL THEN
        NEW.deadline_date := CURRENT_DATE + NEW.total_days;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_action_deadline_trigger ON public.actions;
CREATE TRIGGER set_action_deadline_trigger
    BEFORE INSERT ON public.actions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_action_deadline();

-- Hatırlatma e-postası fonksiyonu (Cron tarafından çağrılacak)
-- Kural: İlk açılışta mail gider (frontend yapar), haftalık Pazartesi hatırlatma,
-- son gün acil, süresi geçmişse her gün
CREATE OR REPLACE FUNCTION public.queue_action_reminders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action RECORD;
    v_count INT := 0;
    v_today DATE := CURRENT_DATE;
    v_day_of_week INT := EXTRACT(DOW FROM CURRENT_DATE); -- 0=Pazar, 1=Pazartesi
    v_subject TEXT;
    v_body TEXT;
    v_to_email TEXT;
    v_urgency TEXT;
    v_days_left INT;
BEGIN
    FOR v_action IN
        SELECT a.id, a.tracking_number, a.action_description, a.nonconformity_description,
               a.deadline_date, a.subcontractor_id, a.total_days,
               s.name as sub_name, s.email as sub_email,
               -- Kişiye atanmış aksiyonlar için
               (SELECT string_agg(p.email, ',')
                FROM action_assignee_users aau
                JOIN profiles p ON p.id = aau.user_id
                WHERE aau.action_id = a.id) as user_emails
        FROM actions a
        LEFT JOIN subcontractors s ON s.id = a.subcontractor_id
        WHERE a.status = 'open'
        AND a.deadline_date IS NOT NULL
    LOOP
        v_days_left := v_action.deadline_date - v_today;

        -- Alıcıyı belirle
        IF v_action.sub_email IS NOT NULL THEN
            v_to_email := v_action.sub_email;
        ELSIF v_action.user_emails IS NOT NULL THEN
            v_to_email := v_action.user_emails;
        ELSE
            CONTINUE; -- Alıcı yok, atla
        END IF;

        -- Hangi durumda mail atalım?
        -- 1. Süresi geçmiş → her gün
        -- 2. Son gün → acil bildirim
        -- 3. Pazartesi → haftalık hatırlatma
        IF v_days_left < 0 THEN
            v_urgency := 'SÜRESI GEÇMİŞ';
        ELSIF v_days_left = 0 THEN
            v_urgency := 'SON GÜN';
        ELSIF v_day_of_week = 1 THEN
            v_urgency := 'HAFTALIK HATIRLATMA';
        ELSE
            CONTINUE; -- Bu gün mail gönderilmeyecek
        END IF;

        v_subject := '[' || v_urgency || '] Aksiyon: ' || COALESCE(v_action.tracking_number, 'N/A');

        v_body := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">'
            || '<div style="background-color:' || CASE WHEN v_days_left < 0 THEN '#dc2626' WHEN v_days_left = 0 THEN '#ea580c' ELSE '#1e293b' END || ';padding:24px;text-align:center;">'
            || '<h1 style="color:#fff;margin:0;font-size:20px;">' || v_urgency || '</h1>'
            || '<p style="color:#fff;opacity:0.8;margin:8px 0 0;font-size:14px;">Aksiyon Takip No: ' || COALESCE(v_action.tracking_number, 'N/A') || '</p>'
            || '</div>'
            || '<div style="padding:24px;background:#fff;">'
            || '<p style="font-size:14px;color:#64748b;">Sayın ' || COALESCE(v_action.sub_name, 'İlgili') || ',</p>';

        IF v_days_left < 0 THEN
            v_body := v_body || '<p style="font-size:14px;color:#dc2626;font-weight:bold;">Bu aksiyonun süresi ' || ABS(v_days_left) || ' gün önce dolmuştur! Acil aksiyon alınız.</p>';
        ELSIF v_days_left = 0 THEN
            v_body := v_body || '<p style="font-size:14px;color:#ea580c;font-weight:bold;">Bu aksiyonun son günüdür! Bugün tamamlanmalıdır.</p>';
        ELSE
            v_body := v_body || '<p style="font-size:14px;color:#334155;">Açık aksiyonunuz bulunmaktadır. Kalan süre: <strong>' || v_days_left || ' gün</strong></p>';
        END IF;

        v_body := v_body
            || '<div style="background:#f1f5f9;padding:12px;border-radius:6px;margin:16px 0;">'
            || '<p style="font-size:13px;color:#64748b;margin:0 0 4px;">Uygunsuzluk:</p>'
            || '<p style="font-size:14px;color:#0f172a;margin:0;">' || v_action.nonconformity_description || '</p>'
            || '</div>'
            || '<div style="background:#dcfce7;padding:12px;border-radius:6px;margin:16px 0;">'
            || '<p style="font-size:13px;color:#64748b;margin:0 0 4px;">Alınacak Aksiyon:</p>'
            || '<p style="font-size:14px;color:#0f172a;margin:0;">' || v_action.action_description || '</p>'
            || '</div>'
            || '<div style="background:' || CASE WHEN v_days_left < 0 THEN '#fee2e2' WHEN v_days_left = 0 THEN '#ffedd5' ELSE '#dbeafe' END || ';padding:12px;border-radius:6px;text-align:center;">'
            || '<p style="margin:0;font-size:14px;color:#0f172a;">Son Tarih: <strong>' || v_action.deadline_date || '</strong></p>'
            || '</div>'
            || '<p style="font-size:12px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px;">Bu e-posta otomatik hatırlatma sistemi tarafından gönderilmiştir.</p>'
            || '</div></div>';

        -- Her alıcıya ayrı mail
        DECLARE
            v_email TEXT;
        BEGIN
            FOREACH v_email IN ARRAY string_to_array(v_to_email, ',')
            LOOP
                INSERT INTO notification_queue (to_email, subject, body_html, status)
                VALUES (TRIM(v_email), v_subject, v_body, 'pending');
                v_count := v_count + 1;
            END LOOP;
        END;
    END LOOP;

    RETURN v_count;
END;
$$;

NOTIFY pgrst, 'reload schema';
