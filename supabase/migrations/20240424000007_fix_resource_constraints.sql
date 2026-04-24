-- Fix constraints for unified resource management
-- Water Consumption Records
ALTER TABLE public.water_consumption_records DROP CONSTRAINT IF EXISTS water_consumption_period_unique;
ALTER TABLE public.water_consumption_records ADD CONSTRAINT water_resource_period_unique UNIQUE(resource_location_id, period_month, period_year);

-- Energy Consumption Records
ALTER TABLE public.energy_consumption_records DROP CONSTRAINT IF EXISTS energy_consumption_period_unique;
ALTER TABLE public.energy_consumption_records ADD CONSTRAINT energy_resource_period_unique UNIQUE(resource_location_id, period_month, period_year);

-- Monthly Headcounts (Ensure constraint name is correct)
ALTER TABLE public.monthly_headcounts DROP CONSTRAINT IF EXISTS monthly_headcounts_loc_period_unique;
ALTER TABLE public.monthly_headcounts ADD CONSTRAINT monthly_headcounts_loc_period_unique UNIQUE(resource_location_id, period_month, period_year);
