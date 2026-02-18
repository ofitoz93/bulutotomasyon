-- 1. company_modules tablosuna süre bilgisi ekle
ALTER TABLE public.company_modules ADD COLUMN IF NOT EXISTS expires_at DATE;
ALTER TABLE public.company_modules ADD COLUMN IF NOT EXISTS is_indefinite BOOLEAN DEFAULT false;

-- 2. Evrak Takip modülünü sisteme ekle
INSERT INTO public.modules (key, name, description)
VALUES ('evrak_takip', 'Evrak Takip', 'Belge ve evrak takip sistemi. Bitiş tarihi, hatırlatma ve dosya yükleme özellikleri.')
ON CONFLICT (key) DO NOTHING;
