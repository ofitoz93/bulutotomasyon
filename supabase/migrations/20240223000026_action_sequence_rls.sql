-- Add RLS policies for company_action_sequences to prevent RLS violation
CREATE POLICY "Sıra Numaralarını Görme" ON public.company_action_sequences FOR SELECT USING (company_id = public.get_my_tenant_id());
CREATE POLICY "Sıra Numarası Ekleme" ON public.company_action_sequences FOR INSERT WITH CHECK (company_id = public.get_my_tenant_id());
CREATE POLICY "Sıra Numarası Güncelleme" ON public.company_action_sequences FOR UPDATE USING (company_id = public.get_my_tenant_id());

-- Also ensure the function is SECURITY DEFINER so it runs smoothly even with tight policies
CREATE OR REPLACE FUNCTION generate_action_tracking_number()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
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
