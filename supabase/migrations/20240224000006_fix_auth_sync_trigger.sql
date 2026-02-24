-- =============================================
-- FIX AUTH.USERS PHONE UNIQUE CONSTRAINT ERROR
-- =============================================

-- It appears there is a trigger that synchronizes updates from public.profiles back to auth.users
-- When phone_number is an empty string (''), it tries to set auth.users.phone = '', 
-- which triggers the "users_phone_key" unique constraint because multiple users have empty strings.

CREATE OR REPLACE FUNCTION public.sync_profile_to_auth()
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
        ),
        -- Critical Fix: Convert empty string to NULL to avoid unique constraint violation on auth.users.phone
        phone = NULLIF(trim(NEW.phone_number), '')
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Just to be safe, if the function name was different (e.g. handle_profile_update), we redefine the most common ones:
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
        ),
        -- Critical Fix: Convert empty string to NULL to avoid unique constraint violation on auth.users.phone
        phone = NULLIF(trim(NEW.phone_number), '')
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also let's clean up any empty strings in profiles table just to be absolutely clean
UPDATE public.profiles SET phone_number = NULL WHERE trim(phone_number) = '';
