/*
# Customer Portal Live Sync + Employee Data Access

1. Purpose
- Enable Supabase Realtime publication on visits, contracts, invoices, payments, service_requests, and notifications tables so the Customer Portal receives live updates when Admin or Worker changes visit status.
- Add an anon SELECT policy on employees table scoped to the authenticated client's own visits, so the Customer Portal can display worker name on visit cards.

2. Realtime
- Adds visits, contracts, invoices, payments, service_requests, notifications to the supabase_realtime publication.
- This allows the Customer Portal's existing .on('postgres_changes') subscriptions to receive events.
- RLS still applies to Realtime — the anon role will only receive events for rows it can see (own visits/contracts/etc via get_client_id_from_token()).

3. Employee Access (anon)
- The Customer Portal queries visits with embedded employee:employees(*) relation.
- The employees table currently has NO anon SELECT policy, so the embedded join returns null for anon role.
- New policy: anon can SELECT employees that are assigned to visits belonging to the authenticated client.
- This is NOT a broad USING(true) — it is scoped through the client's own visits → contracts → employee_id chain.

4. Security
- No existing policies are modified or dropped.
- No broad USING(true) policies added.
- The new employees anon policy is scoped: anon can only see employees assigned to the client's own visits.
- Realtime does not bypass RLS — it respects the same policies as regular SELECT.

5. No QR core changes
- process_visit_qr_scan, QrScannerView, WorkerApp QR handler, same-day guard — all untouched.
*/

-- ── Realtime Publication ──────────────────────────────────────────
-- Add customer-facing tables to the realtime publication so the
-- Customer Portal receives live updates.
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ── Employee Access for Customer Portal ──────────────────────────
-- The Customer Portal (anon role with x-client-token) needs to see
-- the worker assigned to their visits. Scope: only employees assigned
-- to visits that belong to the authenticated client's contracts.
DROP POLICY IF EXISTS "anon_select_assigned_employees" ON employees;
CREATE POLICY "anon_select_assigned_employees"
ON employees FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM visits v
    JOIN contracts c ON c.id = v.contract_id
    WHERE v.employee_id = employees.id
      AND c.client_id = get_client_id_from_token()
  )
);
