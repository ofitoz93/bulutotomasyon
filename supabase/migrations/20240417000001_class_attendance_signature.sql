-- ============================================================
-- course_participants tablosuna imza alanları ekle
-- ============================================================
ALTER TABLE public.course_participants
    ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS signature_data TEXT,
    ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- ============================================================
-- TC Doğrulama + İmza Kayıt RPC Fonksiyonu (SECURITY DEFINER)
-- TC kimliği hiçbir zaman client'a dönmez, server-side doğrulanır
-- ============================================================
CREATE OR REPLACE FUNCTION public.sign_class_attendance(
    p_course_id     UUID,
    p_tc_no         TEXT,
    p_signature     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id    UUID;
    v_participant   RECORD;
    v_full_name     TEXT;
BEGIN
    -- 1. TC ile profil bul
    SELECT id, first_name, last_name
    INTO v_profile_id, v_full_name
    FROM public.profiles
    WHERE tc_no = p_tc_no OR company_employee_no = p_tc_no
    LIMIT 1;

    IF v_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'TC kimlik numarası sistemde bulunamadı.');
    END IF;

    -- 2. Kişi bu kursa katılımcı olarak eklenmiş mi?
    SELECT * INTO v_participant
    FROM public.course_participants
    WHERE course_id = p_course_id AND user_id = v_profile_id;

    IF v_participant IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bu kişi bu eğitim listesinde kayıtlı değil.');
    END IF;

    -- 3. Zaten imzalamış mı?
    IF v_participant.is_signed THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bu kişi zaten imzalamış.');
    END IF;

    -- 4. İmzayı kaydet
    UPDATE public.course_participants
    SET
        is_signed      = true,
        signature_data = p_signature,
        signed_at      = now()
    WHERE course_id = p_course_id AND user_id = v_profile_id;

    -- Ad Soyad döndür (TC değil!)
    SELECT CONCAT(first_name, ' ', last_name) INTO v_full_name
    FROM public.profiles WHERE id = v_profile_id;

    RETURN jsonb_build_object(
        'success',   true,
        'full_name', v_full_name,
        'user_id',   v_profile_id
    );
END;
$$;

-- ============================================================
-- Public okuma için RPC: katılımcı listesini TC'siz döndür
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_class_participants_public(p_course_id UUID)
RETURNS TABLE (
    user_id     UUID,
    full_name   TEXT,
    is_signed   BOOLEAN,
    signed_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cp.user_id,
        CONCAT(pr.first_name, ' ', pr.last_name)::TEXT AS full_name,
        cp.is_signed,
        cp.signed_at
    FROM public.course_participants cp
    JOIN public.profiles pr ON pr.id = cp.user_id
    WHERE cp.course_id = p_course_id
    ORDER BY pr.first_name, pr.last_name;
END;
$$;

-- ============================================================
-- TC Ön Doğrulama RPC: İmza atmadan önce TC kontrolü yapar
-- İmza aşamasına geçmeden önce TC'nin doğru olup olmadığını kontrol eder
-- TC kendisi hiçbir zaman client'a dönmez
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_participant_tc(
    p_course_id UUID,
    p_user_id   UUID,
    p_tc_no     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID;
    v_full_name  TEXT;
    v_is_signed  BOOLEAN;
BEGIN
    -- TC ile profil bul, user_id ile eşleştir
    SELECT id, CONCAT(first_name, ' ', last_name)
    INTO v_profile_id, v_full_name
    FROM public.profiles
    WHERE (tc_no = p_tc_no OR company_employee_no = p_tc_no)
      AND id = p_user_id
    LIMIT 1;

    IF v_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'TC kimlik numarası bu kişiyle eşleşmiyor. Lütfen kontrol edip tekrar deneyin.');
    END IF;

    -- Bu kursa katılımcı olarak eklenmiş mi?
    SELECT is_signed INTO v_is_signed
    FROM public.course_participants
    WHERE course_id = p_course_id AND user_id = v_profile_id;

    IF v_is_signed IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bu kişi bu eğitim listesinde kayıtlı değil.');
    END IF;

    IF v_is_signed THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bu kişi zaten imzalamış.');
    END IF;

    -- Doğrulama başarılı, imza adımına geçilebilir
    RETURN jsonb_build_object('success', true, 'full_name', v_full_name);
END;
$$;

-- ============================================================
-- Fonksiyonları anonim erişime aç (public QR kullanımı için)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.sign_class_attendance(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_class_participants_public(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_participant_tc(UUID, UUID, TEXT) TO anon;

-- Şema önbelleğini yenile
NOTIFY pgrst, 'reload schema';

