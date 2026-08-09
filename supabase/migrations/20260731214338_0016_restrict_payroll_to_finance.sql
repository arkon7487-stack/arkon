-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731214338_0016_restrict_payroll_to_finance

/*
  # Restrict payroll to finance staff (F3)

  Every command on `public.payroll` was granted to `anon` and `authenticated`
  with always-true predicates, so salary records were readable, editable and
  deletable by anyone on the internet holding the public anon key.

  1. Changes
     - Replace all four policies with `authenticated` + `finance` permission
     - Revoke all table privileges from `anon`

  2. Security
     - The Finance page (the only consumer) runs as an authenticated staff user
       with the `finance` permission, so its behaviour is unchanged.
*/

DO $$
DECLARE pol record
;

BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='payroll'
  LOOP EXECUTE format('DROP POLICY %I ON public.payroll', pol.policyname)
;
 END LOOP
;

END $$
;


CREATE POLICY "select_payroll" ON public.payroll
  FOR SELECT TO authenticated USING (public.has_app_permission('finance'))
;

CREATE POLICY "insert_payroll" ON public.payroll
  FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('finance'))
;

CREATE POLICY "update_payroll" ON public.payroll
  FOR UPDATE TO authenticated
  USING (public.has_app_permission('finance'))
  WITH CHECK (public.has_app_permission('finance'))
;

CREATE POLICY "delete_payroll" ON public.payroll
  FOR DELETE TO authenticated USING (public.has_app_permission('finance'))
;


REVOKE ALL ON TABLE public.payroll FROM anon
;

