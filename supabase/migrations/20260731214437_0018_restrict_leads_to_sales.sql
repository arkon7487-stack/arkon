-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731214437_0018_restrict_leads_to_sales

/*
  # Restrict the sales pipeline to signed-in staff (F8)

  `leads` and `lead_activities` granted every command to `anon`, so the entire
  sales pipeline - prospect names, phone numbers, expected deal values, stages
  and notes - was downloadable by anyone with the public anon key, and equally
  editable and deletable.

  1. Changes
     - Replace the policies with `authenticated` + `opportunities` permission
     - Revoke all table privileges from `anon`

  2. Security
     - The Sales pages run as authenticated staff, and the `sales` role holds the
       `opportunities` permission, so the pipeline keeps working for the team.
*/

DO $$
DECLARE pol record
;

BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies
             WHERE schemaname='public' AND tablename IN ('leads','lead_activities')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename)
;
 END LOOP
;

END $$
;


CREATE POLICY "select_leads" ON public.leads
  FOR SELECT TO authenticated USING (public.has_app_permission('opportunities'))
;

CREATE POLICY "insert_leads" ON public.leads
  FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('opportunities'))
;

CREATE POLICY "update_leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (public.has_app_permission('opportunities'))
  WITH CHECK (public.has_app_permission('opportunities'))
;

CREATE POLICY "delete_leads" ON public.leads
  FOR DELETE TO authenticated USING (public.has_app_permission('opportunities'))
;


CREATE POLICY "select_lead_activities" ON public.lead_activities
  FOR SELECT TO authenticated USING (public.has_app_permission('opportunities'))
;

CREATE POLICY "insert_lead_activities" ON public.lead_activities
  FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('opportunities'))
;

CREATE POLICY "delete_lead_activities" ON public.lead_activities
  FOR DELETE TO authenticated USING (public.has_app_permission('opportunities'))
;


REVOKE ALL ON TABLE public.leads FROM anon
;

REVOKE ALL ON TABLE public.lead_activities FROM anon
;

