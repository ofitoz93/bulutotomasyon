-- Link monthly headcounts to resource locations
ALTER TABLE public.monthly_headcounts ADD COLUMN IF NOT EXISTS resource_location_id UUID REFERENCES public.resource_locations(id) ON DELETE CASCADE;

-- Drop old unique constraint if it exists (usually named after the table and columns)
-- In previous migration we had: UNIQUE(tenant_id, period_month, period_year)
-- We need to find the name or just re-add a more specific one.
ALTER TABLE public.monthly_headcounts DROP CONSTRAINT IF EXISTS monthly_headcounts_tenant_id_period_month_period_year_key;

-- Add new unique constraint including location
ALTER TABLE public.monthly_headcounts ADD CONSTRAINT monthly_headcounts_loc_period_unique UNIQUE(tenant_id, resource_location_id, period_month, period_year);
