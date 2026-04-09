-- ADR formlarına şoför imzası alanı ekle
-- İmza base64 PNG veri URL'si olarak saklanır (data:image/png;base64,...)

ALTER TABLE adr_forms
    ADD COLUMN IF NOT EXISTS driver_signature TEXT;

COMMENT ON COLUMN adr_forms.driver_signature IS 'Şoför imzası - base64 PNG formatında veri URL (data:image/png;base64,...)';
