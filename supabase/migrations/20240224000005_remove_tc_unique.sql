-- Remove the UNIQUE constraint from the tc_no column
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tc_no_key;
