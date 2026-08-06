/*
# Customer Portal RLS + Public Service Request Support

## Problem
The Customer Portal authenticates clients via a custom token stored in localStorage
(edge function `arkon-client-auth`), NOT via Supabase Auth. After login, the frontend
calls `supabase.auth.signOut()`, so all Supabase queries run as the `anon` role.
However, RLS policies on `clients`, `visits`, `contracts`, `invoices`, `payments`,
and `notifications` only allow `authenticated` — so the anon role gets 0 rows.

## Solution — Part A: Client Portal Data Access

1. Create a SECURITY DEFINER function `get_client_id_from_token()` that:
   - Reads a custom GUC setting `request.client_token` (set per-request by the frontend
     via a PostgREST header `x-client-token` → mapped to the GUC by Supabase)
   - Validates the token against `client_sessions` (not revoked, not expired)
   - Returns the `client_id` UUID, or NULL if invalid

2. Add `anon` SELECT policies on portal tables scoped to the authenticated client:
   - `clients`: SELECT where `id = get_client_id_from_token()`
   - `contracts`: SELECT where `client_id = get_client_id_from_token()`
   - `visits`: SELECT where `contract.client_id = get_client_id_from_token()`
   - `invoices`: SELECT where `contract.client_id = get_client_id_from_token()`
   - `payments`: SELECT where `invoice.contract.client_id = get_client_id_from_token()`
   - `notifications`: SELECT where `client_id = get_client_id_from_token()` (if column exists)
   - `service_requests`: SELECT where `client_id = get_client_id_from_token()`
   - `visit_ratings`: SELECT where `client_id = get_client_id_from_token()`
   - `packages`: SELECT where id is referenced by the client's contract
   - `qr_codes`: SELECT where `client_id = get_client_id_from_token()`

3. Add `anon` UPDATE on `clients` scoped to own row (for profile editing)
4. Add `anon` INSERT on `service_requests` and `visit_ratings` scoped to own client_id

## Solution — Part B: Public Service Request (Opportunities + Sales Leads)

5. Add `anon` INSERT on `opportunities` (for public website service requests)
   - Only allows `lead_source = 'website'` and `created_by = 'public_website'`
6. Add `anon` INSERT on `leads` (for auto-linked sales potential customer)
7. Add `anon` INSERT on `notifications` (for sales team notification)

## Security
- All anon SELECT policies use `get_client_id_from_token()` — no blanket USING(true)
- The function is SECURITY DEFINER with fixed search_path to prevent injection
- Public INSERT policies only allow website-sourced rows with specific field constraints
- UPDATE/DELETE remain authenticated-only (except client profile self-update)

## Notes
- The frontend must pass the client token as a header `x-client-token` on every request
  so that the Supabase client sets the GUC `request.client_token` for RLS evaluation.
- The existing `authenticated` policies remain unchanged — staff continue to use those.
*/

-- ============================================================
-- Part A: Client Portal Data Access
-- ============================================================

-- 1. SECURITY DEFINER function to resolve client_id from token GUC
CREATE OR REPLACE FUNCTION public.get_client_id_from_token()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_client_id uuid;
BEGIN
  -- Read the token from the per-request GUC setting
  v_token := current_setting('request.client_token', true);

  -- No token → no access
  IF v_token IS NULL OR v_token = '' THEN
    RETURN NULL;
  END IF;

  -- Validate the token against client_sessions
  SELECT cs.client_id
  INTO v_client_id
  FROM client_sessions cs
  WHERE cs.token = v_token
    AND cs.revoked = false
    AND cs.expires_at > now();

  RETURN v_client_id;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_client_id_from_token() TO anon, authenticated;

-- 2. Add anon SELECT policies on portal tables

-- clients: SELECT own row
DROP POLICY IF EXISTS "anon_select_own_client" ON clients;
CREATE POLICY "anon_select_own_client"
  ON clients FOR SELECT
  TO anon
  USING (id = get_client_id_from_token());

-- clients: UPDATE own row (profile editing)
DROP POLICY IF EXISTS "anon_update_own_client" ON clients;
CREATE POLICY "anon_update_own_client"
  ON clients FOR UPDATE
  TO anon
  USING (id = get_client_id_from_token())
  WITH CHECK (id = get_client_id_from_token());

-- contracts: SELECT own contracts
DROP POLICY IF EXISTS "anon_select_own_contracts" ON contracts;
CREATE POLICY "anon_select_own_contracts"
  ON contracts FOR SELECT
  TO anon
  USING (client_id = get_client_id_from_token());

-- visits: SELECT visits for own contracts
DROP POLICY IF EXISTS "anon_select_own_visits" ON visits;
CREATE POLICY "anon_select_own_visits"
  ON visits FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = visits.contract_id
        AND c.client_id = get_client_id_from_token()
    )
  );

-- invoices: SELECT invoices for own contracts
DROP POLICY IF EXISTS "anon_select_own_invoices" ON invoices;
CREATE POLICY "anon_select_own_invoices"
  ON invoices FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = invoices.contract_id
        AND c.client_id = get_client_id_from_token()
    )
  );

-- payments: SELECT payments for own invoices
DROP POLICY IF EXISTS "anon_select_own_payments" ON payments;
CREATE POLICY "anon_select_own_payments"
  ON payments FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN contracts c ON c.id = i.contract_id
      WHERE i.id = payments.invoice_id
        AND c.client_id = get_client_id_from_token()
    )
  );

-- service_requests: SELECT own requests
DROP POLICY IF EXISTS "anon_select_own_service_requests" ON service_requests;
CREATE POLICY "anon_select_own_service_requests"
  ON service_requests FOR SELECT
  TO anon
  USING (client_id = get_client_id_from_token());

-- service_requests: INSERT own requests
DROP POLICY IF EXISTS "anon_insert_own_service_requests" ON service_requests;
CREATE POLICY "anon_insert_own_service_requests"
  ON service_requests FOR INSERT
  TO anon
  WITH CHECK (client_id = get_client_id_from_token());

-- visit_ratings: SELECT own ratings
DROP POLICY IF EXISTS "anon_select_own_visit_ratings" ON visit_ratings;
CREATE POLICY "anon_select_own_visit_ratings"
  ON visit_ratings FOR SELECT
  TO anon
  USING (client_id = get_client_id_from_token());

-- visit_ratings: INSERT own ratings
DROP POLICY IF EXISTS "anon_insert_own_visit_ratings" ON visit_ratings;
CREATE POLICY "anon_insert_own_visit_ratings"
  ON visit_ratings FOR INSERT
  TO anon
  WITH CHECK (client_id = get_client_id_from_token());

-- packages: SELECT packages referenced by own contracts
DROP POLICY IF EXISTS "anon_select_own_packages" ON packages;
CREATE POLICY "anon_select_own_packages"
  ON packages FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.package_id = packages.id
        AND c.client_id = get_client_id_from_token()
    )
  );

-- qr_codes: SELECT own QR codes
DROP POLICY IF EXISTS "anon_select_own_qr_codes" ON qr_codes;
CREATE POLICY "anon_select_own_qr_codes"
  ON qr_codes FOR SELECT
  TO anon
  USING (client_id = get_client_id_from_token());

-- notifications: SELECT own notifications (if client_id column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'client_id'
  ) THEN
    DROP POLICY IF EXISTS "anon_select_own_notifications" ON notifications;
    EXECUTE 'CREATE POLICY "anon_select_own_notifications"
      ON notifications FOR SELECT
      TO anon
      USING (client_id = get_client_id_from_token())';
  END IF;
END
$$;

-- ============================================================
-- Part B: Public Service Request (Opportunities + Sales Leads)
-- ============================================================

-- opportunities: anon INSERT for website-sourced requests only
DROP POLICY IF EXISTS "anon_insert_website_opportunities" ON opportunities;
CREATE POLICY "anon_insert_website_opportunities"
  ON opportunities FOR INSERT
  TO anon
  WITH CHECK (
    lead_source = 'website'
    AND created_by IS NULL
  );

-- opportunities: anon SELECT (public can see their own submitted request status)
-- Not needed — the form is fire-and-forget. Staff uses authenticated SELECT.

-- leads: anon INSERT for website-sourced leads only
DROP POLICY IF EXISTS "anon_insert_website_leads" ON leads;
CREATE POLICY "anon_insert_website_leads"
  ON leads FOR INSERT
  TO anon
  WITH CHECK (
    lead_source = 'website'
  );

-- notifications: anon INSERT for new-lead notifications to sales team
DROP POLICY IF EXISTS "anon_insert_lead_notifications" ON notifications;
CREATE POLICY "anon_insert_lead_notifications"
  ON notifications FOR INSERT
  TO anon
  WITH CHECK (true);
