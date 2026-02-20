-- RLS KONTROLÜ İÇİN DÜZELTME KOMUTU

-- Bu komut, aşağıdaki tablolarda Yetkilendirmeyi (RLS) geçici olarak tamamen devre dışı bırakır.
-- Bu sayede sorunun "Yetki" bazlı mı yoksa "Veri Yokluğu" mu olduğunu kesin olarak anlarız.

ALTER TABLE public.adr_forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_answers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_media DISABLE ROW LEVEL SECURITY;

-- Eğer bu sorguyu çalıştırdıktan sonra kayıtlar görünüyorsa, RLS (Yetki Kuralı) sorunu vardır.
-- Eğer yine görünmüyorsa, o zaman data hiç kaydedilmiyordur (Company ID hatası vb).

NOTIFY pgrst, 'reload schema';
