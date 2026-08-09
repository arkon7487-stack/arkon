-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731214310_0015_restrict_client_pii_to_staff

/*
  # Remove anonymous access to customer records (F1, F2)

  `clients`, `client_emergency_contacts` and `client_medical` all had SELECT
  policies granted to the `anon` role with `USING (true)`, so anyone holding the
  public anon key from the JS bundle could download every customer's name,
  phone, address, national id, emergency contacts and medical notes without
  signing in.

  The client portal's own-record read now goes through
  `public.client_portal_bootstrap(token)`, so anonymous table access is no
  longer needed.

  1. Changes
     - Recreate the SELECT policies for `authenticated` only
     - Require the `clients` permission for writes to the medical and emergency
       contact tables, which hold the most sensitive fields

  2. Security
     - Staff reads are unchanged (all staff screens run as `authenticated`)
     - The unauthenticated Data API surface for these tables is closed
*/

-- clients
DROP POLICY IF EXISTS "read_clients" ON public.clients
;

CREATE POLICY "read_clients" ON public.clients
  FOR SELECT TO authenticated USING (true)
;


-- client_emergency_contacts
DROP POLICY IF EXISTS "read_client_emergency_contacts" ON public.client_emergency_contacts
;

CREATE POLICY "read_client_emergency_contacts" ON public.client_emergency_contacts
  FOR SELECT TO authenticated USING (true)
;


DROP POLICY IF EXISTS "insert_client_emergency_contacts" ON public.client_emergency_contacts
;

CREATE POLICY "insert_client_emergency_contacts" ON public.client_emergency_contacts
  FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('clients'))
;


DROP POLICY IF EXISTS "update_client_emergency_contacts" ON public.client_emergency_contacts
;

CREATE POLICY "update_client_emergency_contacts" ON public.client_emergency_contacts
  FOR UPDATE TO authenticated
  USING (public.has_app_permission('clients'))
  WITH CHECK (public.has_app_permission('clients'))
;


DROP POLICY IF EXISTS "delete_client_emergency_contacts" ON public.client_emergency_contacts
;

CREATE POLICY "delete_client_emergency_contacts" ON public.client_emergency_contacts
  FOR DELETE TO authenticated USING (public.has_app_permission('clients'))
;


-- client_medical
DROP POLICY IF EXISTS "read_client_medical" ON public.client_medical
;

CREATE POLICY "read_client_medical" ON public.client_medical
  FOR SELECT TO authenticated USING (true)
;


DROP POLICY IF EXISTS "insert_client_medical" ON public.client_medical
;

CREATE POLICY "insert_client_medical" ON public.client_medical
  FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('clients'))
;


DROP POLICY IF EXISTS "update_client_medical" ON public.client_medical
;

CREATE POLICY "update_client_medical" ON public.client_medical
  FOR UPDATE TO authenticated
  USING (public.has_app_permission('clients'))
  WITH CHECK (public.has_app_permission('clients'))
;


REVOKE ALL ON TABLE public.clients FROM anon
;

REVOKE ALL ON TABLE public.client_emergency_contacts FROM anon
;

REVOKE ALL ON TABLE public.client_medical FROM anon
;

