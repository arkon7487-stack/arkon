-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260806145202_0036_rls_hardening_stage2.sql

/*
# RLS Hardening — Stage 2 Security Audit
#
# Changes:
# 1. Revoke EXECUTE from anon on internal SECURITY DEFINER functions
# 2. Revoke EXECUTE from authenticated on trigger functions (not RLS helpers)
# 3. Tighten visits: workers SELECT only their own, no INSERT/UPDATE/DELETE
# 4. Tighten employees: workers SELECT only themselves
# 5. Tighten client data tables: workers get no access to financial/payroll
# 6. Admins (super_admin, admin, manager) retain full access
# 7. client_pins/activation_codes/otps: deny all (already no policies = locked)
#
# Rollback: re-create the broad USING(true) policies if needed.
*/

-- ============================================================
-- 1. Revoke anon EXECUTE on internal SECURITY DEFINER functions
-- ============================================================
-- These are trigger functions and RLS helpers that anon should never call.
-- client_portal_bootstrap and client_portal_update_profile stay callable
-- by anon because the customer portal uses token auth, not Supabase Auth.

REVOKE EXECUTE ON FUNCTION public.notify_visit_status_change() FROM anon
;

REVOKE EXECUTE ON FUNCTION public.notify_visit_modified() FROM anon
;

REVOKE EXECUTE ON FUNCTION public.current_user_employee_id() FROM anon
;

REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon
;

REVOKE EXECUTE ON FUNCTION public.get_client_id_from_token() FROM anon
;

REVOKE EXECUTE ON FUNCTION public.get_next_qr_sequence() FROM anon
;


-- Trigger functions should not be callable by authenticated either
-- (they are only invoked by database triggers, not via REST)
REVOKE EXECUTE ON FUNCTION public.notify_visit_status_change() FROM authenticated
;

REVOKE EXECUTE ON FUNCTION public.notify_visit_modified() FROM authenticated
;


-- ============================================================
-- 2. Tighten visits RLS — workers see only their own visits
-- ============================================================
DROP POLICY IF EXISTS "read_visits" ON visits
;

DROP POLICY IF EXISTS "insert_visits" ON visits
;

DROP POLICY IF EXISTS "update_visits" ON visits
;

DROP POLICY IF EXISTS "delete_visits" ON visits
;


-- SELECT: admins see all, workers see only their assigned visits
CREATE POLICY "select_visits" ON visits FOR SELECT
  TO authenticated
  USING (
    is_current_user_admin()
    OR employee_id = current_user_employee_id()
  )
;


-- INSERT: admins only (workers never create visits)
CREATE POLICY "insert_visits" ON visits FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin())
;


-- UPDATE: admins only (workers use QR workflow via SECURITY DEFINER, not direct UPDATE)
CREATE POLICY "update_visits" ON visits FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin())
;


-- DELETE: admins only
CREATE POLICY "delete_visits" ON visits FOR DELETE
  TO authenticated
  USING (is_current_user_admin())
;


-- ============================================================
-- 3. Tighten employees — workers see only their own profile
-- ============================================================
DROP POLICY IF EXISTS "read_employees" ON employees
;


CREATE POLICY "read_employees" ON employees FOR SELECT
  TO authenticated
  USING (
    is_current_user_admin()
    OR id = current_user_employee_id()
  )
;


-- ============================================================
-- 4. Tighten financial tables — admin only
-- ============================================================

-- invoices
DROP POLICY IF EXISTS "read_invoices" ON invoices
;

DROP POLICY IF EXISTS "insert_invoices" ON invoices
;

DROP POLICY IF EXISTS "update_invoices" ON invoices
;

DROP POLICY IF EXISTS "delete_invoices" ON invoices
;


CREATE POLICY "select_invoices" ON invoices FOR SELECT
  TO authenticated USING (is_current_user_admin())
;

CREATE POLICY "insert_invoices" ON invoices FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin())
;

CREATE POLICY "update_invoices" ON invoices FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin())
;

CREATE POLICY "delete_invoices" ON invoices FOR DELETE
  TO authenticated USING (is_current_user_admin())
;


-- payments
DROP POLICY IF EXISTS "read_payments" ON payments
;

DROP POLICY IF EXISTS "insert_payments" ON payments
;

DROP POLICY IF EXISTS "update_payments" ON payments
;

DROP POLICY IF EXISTS "delete_payments" ON payments
;


CREATE POLICY "select_payments" ON payments FOR SELECT
  TO authenticated USING (is_current_user_admin())
;

CREATE POLICY "insert_payments" ON payments FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin())
;

CREATE POLICY "update_payments" ON payments FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin())
;

CREATE POLICY "delete_payments" ON payments FOR DELETE
  TO authenticated USING (is_current_user_admin())
;


-- expenses
DROP POLICY IF EXISTS "select_exp" ON expenses
;

DROP POLICY IF EXISTS "insert_exp" ON expenses
;

DROP POLICY IF EXISTS "update_exp" ON expenses
;

DROP POLICY IF EXISTS "delete_exp" ON expenses
;


CREATE POLICY "select_expenses" ON expenses FOR SELECT
  TO authenticated USING (is_current_user_admin())
;

CREATE POLICY "insert_expenses" ON expenses FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin())
;

CREATE POLICY "update_expenses" ON expenses FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin())
;

CREATE POLICY "delete_expenses" ON expenses FOR DELETE
  TO authenticated USING (is_current_user_admin())
;


-- ============================================================
-- 5. Tighten payroll/salary — admin only
-- ============================================================
-- (salary columns are on employees table; no separate payroll table found)
-- The employees table SELECT is already tightened above.

-- ============================================================
-- 6. Tighten inventory — admin only
-- ============================================================
DROP POLICY IF EXISTS "select_inv_items" ON inventory_items
;

DROP POLICY IF EXISTS "insert_inv_items" ON inventory_items
;

DROP POLICY IF EXISTS "update_inv_items" ON inventory_items
;

DROP POLICY IF EXISTS "delete_inv_items" ON inventory_items
;


CREATE POLICY "select_inv_items" ON inventory_items FOR SELECT
  TO authenticated USING (is_current_user_admin())
;

CREATE POLICY "insert_inv_items" ON inventory_items FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin())
;

CREATE POLICY "update_inv_items" ON inventory_items FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin())
;

CREATE POLICY "delete_inv_items" ON inventory_items FOR DELETE
  TO authenticated USING (is_current_user_admin())
;


DROP POLICY IF EXISTS "select_inv_cat" ON inventory_categories
;

DROP POLICY IF EXISTS "insert_inv_cat" ON inventory_categories
;

DROP POLICY IF EXISTS "update_inv_cat" ON inventory_categories
;

DROP POLICY IF EXISTS "delete_inv_cat" ON inventory_categories
;


CREATE POLICY "select_inv_cat" ON inventory_categories FOR SELECT
  TO authenticated USING (is_current_user_admin())
;

CREATE POLICY "insert_inv_cat" ON inventory_categories FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin())
;

CREATE POLICY "update_inv_cat" ON inventory_categories FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin())
;

CREATE POLICY "delete_inv_cat" ON inventory_categories FOR DELETE
  TO authenticated USING (is_current_user_admin())
;


DROP POLICY IF EXISTS "select_inv_asgn" ON inventory_assignments
;

DROP POLICY IF EXISTS "insert_inv_asgn" ON inventory_assignments
;

DROP POLICY IF EXISTS "update_inv_asgn" ON inventory_assignments
;

DROP POLICY IF EXISTS "delete_inv_asgn" ON inventory_assignments
;


CREATE POLICY "select_inv_asgn" ON inventory_assignments FOR SELECT
  TO authenticated USING (is_current_user_admin())
;

CREATE POLICY "insert_inv_asgn" ON inventory_assignments FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin())
;

CREATE POLICY "update_inv_asgn" ON inventory_assignments FOR UPDATE
  TO authenticated USING (is_current_user_admin()) WITH CHECK (is_current_user_admin())
;

CREATE POLICY "delete_inv_asgn" ON inventory_assignments FOR DELETE
  TO authenticated USING (is_current_user_admin())
;


DROP POLICY IF EXISTS "select_inv_mov" ON inventory_movements
;

DROP POLICY IF EXISTS "insert_inv_mov" ON inventory_movements
;


CREATE POLICY "select_inv_mov" ON inventory_movements FOR SELECT
  TO authenticated USING (is_current_user_admin())
;

CREATE POLICY "insert_inv_mov" ON inventory_movements FOR INSERT
  TO authenticated WITH CHECK (is_current_user_admin())
;


-- ============================================================
-- 7. Tighten settings — admin only
-- ============================================================
DROP POLICY IF EXISTS "read_settings" ON settings
;


CREATE POLICY "read_settings" ON settings FOR SELECT
  TO authenticated USING (is_current_user_admin())
;


-- ============================================================
-- 8. Tighten roles/permissions — admin only
-- ============================================================
DROP POLICY IF EXISTS "select_roles" ON roles
;

DROP POLICY IF EXISTS "select_permissions" ON permissions
;

DROP POLICY IF EXISTS "select_role_permissions" ON role_permissions
;


CREATE POLICY "select_roles" ON roles FOR SELECT
  TO authenticated USING (is_current_user_admin())
;

CREATE POLICY "select_permissions" ON permissions FOR SELECT
  TO authenticated USING (is_current_user_admin())
;

CREATE POLICY "select_role_permissions" ON role_permissions FOR SELECT
  TO authenticated USING (is_current_user_admin())
;


-- ============================================================
-- 9. Tighten audit_logs — admin only SELECT, authenticated INSERT
-- ============================================================
DROP POLICY IF EXISTS "read_audit_logs" ON audit_logs
;


CREATE POLICY "read_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (is_current_user_admin())
;

