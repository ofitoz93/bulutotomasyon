-- Document tracking reminders RPC function
-- Finds non-indefinite documents that are within their reminder window or expired.
-- Groups the notifications by user so each user gets only one combined email per day.

CREATE OR REPLACE FUNCTION public.queue_document_reminders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_doc RECORD;
    v_count INT := 0;
    v_today DATE := CURRENT_DATE;
    v_subject TEXT;
    v_body TEXT;
    v_target_date DATE;
    v_days_left INT;
    v_has_docs BOOLEAN;
BEGIN
    -- 1. Get all users who have at least one active document approaching its deadline
    FOR v_user IN
        SELECT DISTINCT d.user_id, p.email, p.first_name, p.last_name
        FROM public.documents d
        JOIN public.profiles p ON p.id = d.user_id
        WHERE d.is_archived = false
          AND d.is_indefinite = false
          AND (d.application_deadline IS NOT NULL OR d.expiry_date IS NOT NULL)
          -- Condition: target_date - current_date <= reminder_days_before OR < 0
          AND (
              COALESCE(d.application_deadline, d.expiry_date) - v_today <= COALESCE(d.reminder_days_before, 5)
          )
    LOOP
        v_has_docs := false;
        v_subject := 'Evrak Takip Hatırlatması: Yaklaşan veya Süresi Geçen Belgeleriniz';
        
        v_body := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">'
            || '<div style="background-color:#4f46e5;padding:24px;text-align:center;">'
            || '<h1 style="color:#fff;margin:0;font-size:20px;">Evrak Takip Bildirimi</h1>'
            || '</div>'
            || '<div style="padding:24px;background:#fff;">'
            || '<p style="font-size:14px;color:#64748b;">Sayın ' || COALESCE(v_user.first_name || ' ' || v_user.last_name, 'Kullanıcı') || ',</p>'
            || '<p style="font-size:14px;color:#334155;">Aşağıdaki belgelerinizin süresi yaklaşmakta veya geçmiştir. Lütfen sistem üzerinden gerekli işlemleri (yenileme/arşivleme) gerçekleştiriniz.</p>'
            || '<table style="width:100%;border-collapse:collapse;margin-top:20px;">'
            || '<thead>'
            || '<tr style="background:#f1f5f9;text-align:left;">'
            || '<th style="padding:10px;font-size:13px;color:#475569;border-bottom:2px solid #e2e8f0;">Belge Türü</th>'
            || '<th style="padding:10px;font-size:13px;color:#475569;border-bottom:2px solid #e2e8f0;">Lokasyon</th>'
            || '<th style="padding:10px;font-size:13px;color:#475569;border-bottom:2px solid #e2e8f0;">Son Tarih</th>'
            || '<th style="padding:10px;font-size:13px;color:#475569;border-bottom:2px solid #e2e8f0;">Kalan Süre</th>'
            || '</tr>'
            || '</thead>'
            || '<tbody>';

        -- 2. Fetch the actual documents for this user
        FOR v_doc IN
            SELECT d.id, 
                   dt.name as type_name, 
                   l.name as location_name,
                   d.title,
                   COALESCE(d.application_deadline, d.expiry_date) as target_date,
                   (COALESCE(d.application_deadline, d.expiry_date) - v_today) as days_left
            FROM public.documents d
            LEFT JOIN public.document_types dt ON dt.id = d.document_type_id
            LEFT JOIN public.locations l ON l.id = d.location_id
            WHERE d.user_id = v_user.user_id
              AND d.is_archived = false
              AND d.is_indefinite = false
              AND (d.application_deadline IS NOT NULL OR d.expiry_date IS NOT NULL)
              AND (COALESCE(d.application_deadline, d.expiry_date) - v_today <= COALESCE(d.reminder_days_before, 5))
            ORDER BY target_date ASC
        LOOP
            v_has_docs := true;
            
            v_body := v_body || '<tr>'
                || '<td style="padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0;">' 
                || COALESCE(v_doc.title, v_doc.type_name, 'İsimsiz Belge') || '</td>'
                || '<td style="padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0;">' 
                || COALESCE(v_doc.location_name, '-') || '</td>'
                || '<td style="padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0;font-weight:bold;">' 
                || TO_CHAR(v_doc.target_date, 'DD.MM.YYYY') || '</td>';
            
            IF v_doc.days_left < 0 THEN
                v_body := v_body || '<td style="padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0;color:#dc2626;font-weight:bold;">Süresi Geçti (' || ABS(v_doc.days_left) || ' gün)</td>';
            ELSIF v_doc.days_left = 0 THEN
                v_body := v_body || '<td style="padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0;color:#ea580c;font-weight:bold;">BUGÜN!</td>';
            ELSE
                v_body := v_body || '<td style="padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0;color:#ca8a04;">' || v_doc.days_left || ' gün kaldı</td>';
            END IF;
            
            v_body := v_body || '</tr>';
        END LOOP;
        
        v_body := v_body || '</tbody></table>'
            || '<p style="font-size:12px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px;">Bu e-posta Bulut Otomasyon otomatik hatırlatma sistemi tarafından gönderilmiştir.</p>'
            || '</div></div>';

        -- 3. If docs were found, insert the combined email into the queue
        IF v_has_docs = true AND v_user.email IS NOT NULL THEN
            INSERT INTO public.notification_queue (to_email, subject, body_html, status)
            VALUES (TRIM(v_user.email), v_subject, v_body, 'pending');
            v_count := v_count + 1;
        END IF;

    END LOOP;

    RETURN v_count;
END;
$$;

NOTIFY pgrst, 'reload schema';
