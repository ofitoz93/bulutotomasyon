-- Unifying Locations for Resource Management
CREATE TABLE IF NOT EXISTS public.resource_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    total_area_m2 DECIMAL(10,2),
    target_reduction_percent DECIMAL(5,2) DEFAULT 5.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for resource_locations
ALTER TABLE public.resource_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their company's resource locations" ON public.resource_locations
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Migrate existing locations to the new table (optional but good for transition)
INSERT INTO public.resource_locations (tenant_id, name, total_area_m2, target_reduction_percent)
SELECT tenant_id, name, total_area_m2, target_reduction_percent FROM public.water_locations
ON CONFLICT DO NOTHING;

INSERT INTO public.resource_locations (tenant_id, name, total_area_m2, target_reduction_percent)
SELECT tenant_id, name, total_area_m2, target_reduction_percent FROM public.energy_locations
ON CONFLICT DO NOTHING;

-- Update consumption records to use the new location table
-- Note: This requires caution if IDs are already used. 
-- In a real scenario, we'd add a new column 'resource_location_id', migrate, then drop old one.
-- For this development phase, we'll add the column.

ALTER TABLE public.water_consumption_records ADD COLUMN IF NOT EXISTS resource_location_id UUID REFERENCES public.resource_locations(id) ON DELETE CASCADE;
ALTER TABLE public.energy_consumption_records ADD COLUMN IF NOT EXISTS resource_location_id UUID REFERENCES public.resource_locations(id) ON DELETE CASCADE;
