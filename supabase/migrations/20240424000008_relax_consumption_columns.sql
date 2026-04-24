-- Relaxing column requirements for unified resource management
-- Since we now use resource_location_id and a separate monthly_headcounts table

-- Water Consumption Records
ALTER TABLE public.water_consumption_records ALTER COLUMN location_id DROP NOT NULL;
ALTER TABLE public.water_consumption_records ALTER COLUMN headcount DROP NOT NULL;

-- Energy Consumption Records
ALTER TABLE public.energy_consumption_records ALTER COLUMN location_id DROP NOT NULL;
ALTER TABLE public.energy_consumption_records ALTER COLUMN headcount DROP NOT NULL;
