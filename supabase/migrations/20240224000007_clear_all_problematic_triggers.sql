-- =============================================
-- DEFINITIVE FIX FOR 'users_phone_key' ERROR
-- =============================================

-- Step 1: Automatically find and drop ANY existing UPDATE trigger on public.profiles
-- This ensures that whatever sneaky trigger was created in the past (e.g. on_profile_update, sync_auth, etc.) is removed.
DO $$ 
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'public' 
        AND event_object_table = 'profiles'
        AND event_manipulation = 'UPDATE'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.profiles', trigger_record.trigger_name);
    END LOOP;
END $$;

-- Step 2: Create a SAFE function that only syncs metadata (first_name, last_name)
-- and completely ignores the "phone" field to prevent "users_phone_key" unique constraint errors!
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE auth.users 
    SET 
        raw_user_meta_data = jsonb_build_object(
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'full_name', trim(NEW.first_name || ' ' || NEW.last_name),
            'name', trim(NEW.first_name || ' ' || NEW.last_name),
            'display_name', trim(NEW.first_name || ' ' || NEW.last_name)
        )
        -- DİKKAT: users_phone_key hatasına yol açtığı için phone = NEW.phone_number senkronizasyonunu buradan KALDIRDIK.
        -- Sistem zaten numarayı profiles.phone_number üzerinde tutuyor.
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Attach the safe trigger back to the table
CREATE TRIGGER on_profile_updated
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    WHEN (OLD.first_name IS DISTINCT FROM NEW.first_name OR OLD.last_name IS DISTINCT FROM NEW.last_name)
    EXECUTE FUNCTION public.handle_profile_update();
