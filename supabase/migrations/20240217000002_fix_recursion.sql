-- is_system_admin fonksiyonunu RLS kontrolü yapmadan çalışacak şekilde güncelle
-- Bu sayede profiles tablosunu sorgularken loop'a girmeyecek.

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off -- BU SATIR RLS'Yİ DEVRE DIŞI BIRAKIR (Sadece fonksiyon içinde)
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'system_admin'
  );
END;
$$;
