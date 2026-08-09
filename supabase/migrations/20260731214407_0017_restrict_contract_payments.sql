-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731214407_0017_restrict_contract_payments

/*
  # Restrict contract payments to finance staff (F7)

  Every command on `public.contract_payments` was granted to `anon` and
  `authenticated` with always-true predicates, so the whole payment ledger was
  readable by the internet and anyone could invent or delete payments.

  1. Changes
     - Replace all four policies with `authenticated` + `finance` permission
     - Revoke all table privileges from `anon`

  2. Security
     - The Finance page and contract detail page read this ledger as
       authenticated finance staff, so their behaviour is unchanged.
     - Inserts continue to work for finance staff, and will additionally be
       routed through an atomic SECURITY DEFINER function.
*/

DO $$
DECLARE pol record
;

BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='contract_payments'
  LOOP EXECUTE format('DROP POLICY %I ON public.contract_payments', pol.policyname)
;
 END LOOP
;

END $$
;


CREATE POLICY "select_contract_payments" ON public.contract_payments
  FOR SELECT TO authenticated USING (public.has_app_permission('finance'))
;

CREATE POLICY "insert_contract_payments" ON public.contract_payments
  FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('finance'))
;

CREATE POLICY "update_contract_payments" ON public.contract_payments
  FOR UPDATE TO authenticated
  USING (public.has_app_permission('finance'))
  WITH CHECK (public.has_app_permission('finance'))
;

CREATE POLICY "delete_contract_payments" ON public.contract_payments
  FOR DELETE TO authenticated USING (public.has_app_permission('finance'))
;


REVOKE ALL ON TABLE public.contract_payments FROM anon
;

