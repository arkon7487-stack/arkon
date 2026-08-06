-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731215900_0026_drop_leftover_permissive_policies

/*
  # Drop leftover always-true policies on companies and settings

  Permissive policies are OR-ed together, so the older `USING (true)` /
  `WITH CHECK (true)` policies left on `companies` and `settings` cancelled the
  permission checks added by the settings-hardening migration.

  1. Changes
     - Drop `staff_update_companies`, `staff_write_companies` on public.companies
     - Drop `write_settings` on public.settings

  2. Security
     - Company profile and system settings can now only be written by staff
       holding the `settings` permission
;
 reads are unchanged.
*/

DROP POLICY IF EXISTS staff_update_companies ON public.companies
;

DROP POLICY IF EXISTS staff_write_companies ON public.companies
;

DROP POLICY IF EXISTS write_settings ON public.settings
;

