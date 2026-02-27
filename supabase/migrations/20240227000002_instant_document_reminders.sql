-- Automatically queue a reminder email if a NEW document is inserted 
-- and its target date is already within the reminder window.

CREATE OR REPLACE FUNCTION public.trigger_instant_document_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_target_date DATE;
    v_days_left INT;
    v_subject TEXT;
    v_body TEXT;
    v_type_name TEXT;
    v_location_name TEXT;
BEGIN
    -- Only for active, definite documents
    IF NEW.is_archived = true OR NEW.is_indefinite = true THEN
        RETURN NEW;
    END IF;

    -- Calculate target date and days left
    v_target_date := COALESCE(NEW.application_deadline, NEW.expiry_date);
    
    IF v_target_date IS NULL THEN
        RETURN NEW;
    END IF;

    v_days_left := v_target_date - CURRENT_DATE;

    -- If the document is within the reminder window or already expired
    IF v_days_left <= COALESCE(NEW.reminder_days_before, 5) THEN
        
        -- Fetch user info
        SELECT email, first_name, last_name INTO v_user
        FROM public.profiles
        WHERE id = NEW.user_id;

        IF v_user.email IS NULL THEN
            RETURN NEW;
        END IF;

        -- Fetch type and location names
        SELECT name INTO v_type_name FROM public.document_types WHERE id = NEW.document_type_id;
        SELECT name INTO v_location_name FROM public.locations WHERE id = NEW.location_id;

        v_subject := 'Evrak Takip Hatırlatması: Yeni Eklenen Belge Süresi';
        
        v_body := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">'
            || '<div style="background-color:#4f46e5;padding:24px;text-align:center;">'
            || '<h1 style="color:#fff;margin:0;font-size:20px;">Evrak Takip Bildirimi</h1>'
            || '</div>'
            || '<div style="padding:24px;background:#fff;">'
            || '<p style="font-size:14px;color:#64748b;">Sayın ' || COALESCE(v_user.first_name || ' ' || v_user.last_name, 'Kullanıcı') || ',</p>'
            || '<p style="font-size:14px;color:#334155;">Sisteme yeni eklenen aşağıdaki belgenizin süresi yaklaşmakta veya geçmiştir. Lütfen sistem üzerinden gerekli işlemleri gerçekleştiriniz.</p>'
            || '<table style="width:100%;border-collapse:collapse;margin-top:20px;">'
            || '<thead>'
            || '<tr style="background:#f1f5f9;text-align:left;">'
            || '<th style="padding:10px;font-size:13px;color:#475569;border-bottom:2px solid #e2e8f0;">Belge Türü</th>'
            || '<th style="padding:10px;font-size:13px;color:#475569;border-bottom:2px solid #e2e8f0;">Lokasyon</th>'
            || '<th style="padding:10px;font-size:13px;color:#475569;border-bottom:2px solid #e2e8f0;">Son Tarih</th>'
            || '<th style="padding:10px;font-size:13px;color:#475569;border-bottom:2px solid #e2e8f0;">Kalan Süre</th>'
            || '</tr>'
            || '</thead>'
            || '<tbody>'
            || '<tr>'
            || '<td style="padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0;">' 
            || COALESCE(NEW.title, v_type_name, 'İsimsiz Belge') || '</td>'
            || '<td style="padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0;">' 
            || COALESCE(v_location_name, '-') || '</td>'
            || '<td style="padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0;font-weight:bold;">' 
            || TO_CHAR(v_target_date, 'DD.MM.YYYY') || '</td>';
        
        IF v_days_left < 0 THEN
            v_body := v_body || '<td style="padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0;color:#dc2626;font-weight:bold;">Süresi Geçti (' || ABS(v_days_left) || ' gün)</td>';
        ELSIF v_days_left = 0 THEN
            v_body := v_body || '<td style="padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0;color:#ea580c;font-weight:bold;">BUGÜN!</td>';
        ELSE
            v_body := v_body || '<td style="padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0;color:#ca8a04;">' || v_days_left || ' gün kaldı</td>';
        END IF;
        
        v_body := v_body || '</tr></tbody></table>'
            || '<p style="font-size:12px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px;">Bu e-posta Bulut Otomasyon otomatik hatırlatma sistemi tarafından gönderilmiştir.</p>'
            || '</div></div>';

        -- Insert into queue so the Edge function or a webhook picks it up
        INSERT INTO public.notification_queue (to_email, subject, body_html, status)
        VALUES (TRIM(v_user.email), v_subject, v_body, 'pending');

        -- WE ALSO CALL THE EDGE FUNCTION HTTP ENDPOINT TO SEND IMMEDIATELY
        -- Note: We use pg_net extension if available, otherwise just leave it in the queue 
        -- and let the user's frontend fetch or next cron run pick it up. 
        -- A safer multi-tenant approach is to just let the frontend send it if it's new.
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_instant_document_reminder ON public.documents;
CREATE TRIGGER tr_instant_document_reminder
    AFTER INSERT ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_instant_document_reminder();

NOTIFY pgrst, 'reload schema';
