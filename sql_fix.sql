-- 1. Modüller tablosuna kategori kolonunu ekle
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Genel';

-- 2. Şirket modülleri tablosuna kategori override kolonunu ekle
ALTER TABLE public.company_modules ADD COLUMN IF NOT EXISTS category_override TEXT;

-- 3. Eksik modülleri ekle (Seed)
INSERT INTO public.modules (key, name, description, category)
VALUES
('evrak_takip', 'Evrak Takip', 'Evraklarınızı dijital ortamda saklayın ve yönetin.', 'İdari İşler'),
('ekipman_takip', 'Ekipman Takip', 'Ekipmanlarınızın konumunu ve bakım durumunu takip edin.', 'Operasyon')
ON CONFLICT (key) DO UPDATE
SET category = EXCLUDED.category;

-- 4. Şema önbelleğini yenile (Supabase API'sinin yeni kolonları görmesi için şart)
NOTIFY pgrst, 'reload schema';
