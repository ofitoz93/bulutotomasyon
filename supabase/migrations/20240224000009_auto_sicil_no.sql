-- =============================================
-- OTOMATİK SİCİL NUMARASI TANIMLAMA
-- =============================================

-- 1. Mevcutta sicil numarası (company_employee_no) olmayan kullanıcılara rastgele benzersiz sicil no ata
DO $$ 
DECLARE
    prof RECORD;
    new_sicil TEXT;
    is_unique BOOLEAN;
BEGIN
    FOR prof IN SELECT id, tenant_id FROM public.profiles WHERE company_employee_no IS NULL AND tenant_id IS NOT NULL LOOP
        LOOP
            new_sicil := 'PER-' || floor(random() * 900000 + 100000)::text; -- PER-XXXXXX
            
            -- Aynı tenant içinde bu sicil kullanılmış mı kontrol et
            SELECT NOT EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE tenant_id = prof.tenant_id AND company_employee_no = new_sicil
            ) INTO is_unique;
            
            EXIT WHEN is_unique;
        END LOOP;
        
        UPDATE public.profiles SET company_employee_no = new_sicil WHERE id = prof.id;
    END LOOP;
END $$;

-- 2. Yeni eklenecek kullanıcıların company_employee_no'su boş gelirse onlara da yine trigger vasıtasıyla atama yap
CREATE OR REPLACE FUNCTION public.auto_assign_sicil_no()
RETURNS TRIGGER AS $$
DECLARE
    new_sicil TEXT;
    is_unique BOOLEAN;
BEGIN
    IF NEW.company_employee_no IS NULL AND NEW.tenant_id IS NOT NULL THEN
        LOOP
            new_sicil := 'PER-' || floor(random() * 900000 + 100000)::text;
            
            SELECT NOT EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE tenant_id = NEW.tenant_id AND company_employee_no = new_sicil
            ) INTO is_unique;
            
            IF is_unique THEN
                NEW.company_employee_no := new_sicil;
                EXIT;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_sicil_no_trigger ON public.profiles;
CREATE TRIGGER ensure_sicil_no_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_sicil_no();
