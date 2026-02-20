-- Modüller tablosuna kategori kolonu ekle
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Genel';

-- Şirket modülleri tablosuna kategori geçersiz kılma (override) kolonu ekle
ALTER TABLE public.company_modules ADD COLUMN IF NOT EXISTS category_override TEXT;

-- Mevcut modülleri güncelle (İsteğe bağlı varsayılanlar)
UPDATE public.modules SET category = 'Operasyon' WHERE key = 'ekipman_takip';
UPDATE public.modules SET category = 'İdari İşler' WHERE key = 'evrak_takip';

-- Şema önbelleğini yenile
NOTIFY pgrst, 'reload schema';
