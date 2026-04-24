-- Add target_reduction_percent to water_locations
ALTER TABLE public.water_locations 
ADD COLUMN IF NOT EXISTS target_reduction_percent DECIMAL(5,2) DEFAULT 5.00;
