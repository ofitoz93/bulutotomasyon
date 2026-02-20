-- 1. Modül Kategorileri (Module Categories) tablosunu oluştur
CREATE TABLE IF NOT EXISTS public.module_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Etkinleştir
ALTER TABLE public.module_categories ENABLE ROW LEVEL SECURITY;

-- Politikalar: Herkes okuyabilir, sadece admin yönetebilir
CREATE POLICY "Herkes kategorileri görebilir" ON public.module_categories FOR SELECT USING (true);
CREATE POLICY "Sistem yöneticileri kategori yönetebilir" ON public.module_categories FOR ALL USING (public.is_system_admin());

-- 2. Modüller tablosuna category_id ekle
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.module_categories(id) ON DELETE SET NULL;

-- 3. Mevcut verileri göç et (Migration)
-- Mevcut 'category' metin alanındaki benzersiz değerleri kategoriler tablosuna ekle
INSERT INTO public.module_categories (name)
SELECT DISTINCT category FROM public.modules WHERE category IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Modülleri yeni kategori ID'leri ile güncelle
UPDATE public.modules m
SET category_id = mc.id
FROM public.module_categories mc
WHERE m.category = mc.name;

-- (İsteğe bağlı) Eski category kolonunu daha sonra kaldırabiliriz, şimdilik geriye dönük uyumluluk için kalsın.
-- Ancak frontend artık category_id ve ilişkili tabloyu kullanmalı.

-- Şema önbelleğini yenile
NOTIFY pgrst, 'reload schema';
