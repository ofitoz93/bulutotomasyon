-- Legal Regulations tablosuna son değişiklik sayısı sütunu ekle
ALTER TABLE public.legal_regulations ADD COLUMN IF NOT EXISTS last_modification_number TEXT;
