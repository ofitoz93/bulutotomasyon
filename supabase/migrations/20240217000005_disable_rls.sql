-- ACİL ÇÖZÜM: RLS'yi geçici olarak kapatıyoruz.
-- Bu işlem "Infinite Recursion" hatasını kesinlikle durduracaktır.
-- Daha sonra RLS'yi düzgün politikalarla tekrar açacağız.

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_modules DISABLE ROW LEVEL SECURITY;
