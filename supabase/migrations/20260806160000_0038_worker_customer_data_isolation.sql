-- ============================================================
-- Migration: worker_customer_data_isolation
-- Purpose: Fix critical cross-user data isolation issues
--   1. Prevent customer A from seeing customer B's data (service_requests, visit_ratings)
--   2. Prevent worker A from seeing worker B's clients/contracts
--   3. Restrict service_requests and visit_ratings writes to admin/manager only
-- ============================================================
--
-- ROLLBACK INFORMATION:
-- All previous policy definitions are documented below.
-- To rollback, DROP the new policies and re-create the old ones.
--
-- OLD POLICIES (for rollback):
--
-- service_requests:
--   select_service_requests: SELECT, {anon,authenticated}, USING(true)
--   insert_service_requests: INSERT, {anon,authenticated}, WITH CHECK(true)
--   update_service_requests: UPDATE, {authenticated}, USING(true), WITH CHECK(true)
--   delete_service_requests: DELETE, {authenticated}, USING(true)
--   anon_select_own_service_requests: SELECT, {anon}, USING(client_id = get_client_id_from_token())
--   anon_insert_own_service_requests: INSERT, {anon}, WITH CHECK(client_id = get_client_id_from_token())
--
-- visit_ratings:
--   select_visit_ratings: SELECT, {anon,authenticated}, USING(true)
--   insert_visit_ratings: INSERT, {anon,authenticated}, WITH CHECK(true)
--   update_visit_ratings: UPDATE, {authenticated}, USING(true), WITH CHECK(true)
--   delete_visit_ratings: DELETE, {authenticated}, USING(true)
--   anon_select_own_visit_ratings: SELECT, {anon}, USING(client_id = get_client_id_from_token())
--   anon_insert_own_visit_ratings: INSERT, {anon}, WITH CHECK(client_id = get_client_id_from_token())
--
-- clients:
--   read_clients: SELECT, {authenticated}, USING(true)
--
-- contracts:
--   read_contracts: SELECT, {authenticated}, USING(true)
--
-- ============================================================

-- ============================================================
-- PART 1: service_requests — Fix cross-customer anon leak + auth over-permission
-- ============================================================

-- Drop the broad policies that OR-override the restrictive anon policies
DROP POLICY IF EXISTS select_service_requests ON public.service_requests;
DROP POLICY IF EXISTS insert_service_requests ON public.service_requests;
DROP POLICY IF EXISTS update_service_requests ON public.service_requests;
DROP POLICY IF EXISTS delete_service_requests ON public.service_requests;

-- Keep the existing anon policies (they are correct):
--   anon_select_own_service_requests: client_id = get_client_id_from_token()
--   anon_insert_own_service_requests: client_id = get_client_id_from_token()

-- New: authenticated SELECT — admin/manager only (workers don't need service requests)
CREATE POLICY "select_service_requests_staff" ON public.service_requests
  FOR SELECT TO authenticated
  USING (is_current_user_admin());

-- New: authenticated INSERT — admin/manager only
CREATE POLICY "insert_service_requests_staff" ON public.service_requests
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_admin());

-- New: authenticated UPDATE — admin/manager only
CREATE POLICY "update_service_requests_staff" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- New: authenticated DELETE — admin/manager only
CREATE POLICY "delete_service_requests_staff" ON public.service_requests
  FOR DELETE TO authenticated
  USING (is_current_user_admin());

-- ============================================================
-- PART 2: visit_ratings — Fix cross-customer anon leak + auth over-permission
-- ============================================================

-- Drop the broad policies that OR-override the restrictive anon policies
DROP POLICY IF EXISTS select_visit_ratings ON public.visit_ratings;
DROP POLICY IF EXISTS insert_visit_ratings ON public.visit_ratings;
DROP POLICY IF EXISTS update_visit_ratings ON public.visit_ratings;
DROP POLICY IF EXISTS delete_visit_ratings ON public.visit_ratings;

-- Keep the existing anon policies (they are correct):
--   anon_select_own_visit_ratings: client_id = get_client_id_from_token()
--   anon_insert_own_visit_ratings: client_id = get_client_id_from_token()

-- New: authenticated SELECT — admin/manager only
CREATE POLICY "select_visit_ratings_staff" ON public.visit_ratings
  FOR SELECT TO authenticated
  USING (is_current_user_admin());

-- New: authenticated INSERT — admin/manager only
CREATE POLICY "insert_visit_ratings_staff" ON public.visit_ratings
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_admin());

-- New: authenticated UPDATE — admin/manager only
CREATE POLICY "update_visit_ratings_staff" ON public.visit_ratings
  FOR UPDATE TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- New: authenticated DELETE — admin/manager only
CREATE POLICY "delete_visit_ratings_staff" ON public.visit_ratings
  FOR DELETE TO authenticated
  USING (is_current_user_admin());

-- ============================================================
-- PART 3: clients — Restrict worker access to only clients connected to own visits
-- ============================================================

-- Drop the broad read policy
DROP POLICY IF EXISTS read_clients ON public.clients;

-- New: authenticated SELECT — admin sees all, workers see only clients
-- connected to visits assigned to them
CREATE POLICY "read_clients_scoped" ON public.clients
  FOR SELECT TO authenticated
  USING (
    is_current_user_admin()
    OR EXISTS (
      SELECT 1 FROM public.visits v
      JOIN public.contracts c ON c.id = v.contract_id
      WHERE v.employee_id = current_user_employee_id()
        AND c.client_id = clients.id
    )
  );

-- ============================================================
-- PART 4: contracts — Restrict worker access to only contracts connected to own visits
-- ============================================================

-- Drop the broad read policy
DROP POLICY IF EXISTS read_contracts ON public.contracts;

-- New: authenticated SELECT — admin sees all, workers see only contracts
-- connected to visits assigned to them
CREATE POLICY "read_contracts_scoped" ON public.contracts
  FOR SELECT TO authenticated
  USING (
    is_current_user_admin()
    OR EXISTS (
      SELECT 1 FROM public.visits v
      WHERE v.employee_id = current_user_employee_id()
        AND v.contract_id = contracts.id
    )
  );
