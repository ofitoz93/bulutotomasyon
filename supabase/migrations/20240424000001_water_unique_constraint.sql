-- Su tüketim kayıtları için mükerrer kaydı önleme (Aynı lokasyon, yıl ve ay için tek kayıt)
ALTER TABLE public.water_consumption_records 
ADD CONSTRAINT unique_location_period UNIQUE (location_id, period_year, period_month);
