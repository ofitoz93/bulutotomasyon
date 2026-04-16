INSERT INTO public.modules (key, name, description)
VALUES ('tmgd', 'TMGD Taşıma Evrakı', 'Müşterilere (Firmalara) özel şifreli URL atanarak ADR Taşıma Evrakının formüllerle otomatik üretilmesini sağlayan portal modülü.')
ON CONFLICT (key) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description;
