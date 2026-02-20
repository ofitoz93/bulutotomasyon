-- RLS'İ TEKRAR AKTİFLEŞTİRME KOMUTU

-- Sorunun veri sorgulamasından (full_name sütunu yokluğu) olduğu tespit edildiği için
-- veri güvenliğini sağlayan Row Level Security (RLS) kurallarını tekrar devreye alıyoruz.

ALTER TABLE public.adr_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_media ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
