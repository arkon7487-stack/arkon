-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260806144036_0035_realtime_notification_system.sql

/*
# Realtime Notification System for ARKON

## Architecture
- DB triggers on visits table auto-create notification records
- New columns: recipient_employee_id, notification_type, metadata (JSONB)
- RLS ensures workers only see their own notifications
- Admins see all notifications
- The notification delivery layer (sounds, toasts, browser notifications) is in the frontend
- For future mobile push: only the delivery layer changes, business logic stays identical

## Notification Types
- visit_assigned: new visit assigned to worker
- visit_updated: assigned visit modified
- visit_cancelled: assigned visit cancelled
- visit_started: worker started visit (admin notification)
- visit_completed: worker completed visit (admin notification)
*/

-- 1. Add columns to notifications table
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS notification_type text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb
;


-- Index for efficient per-worker queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_employee
  ON notifications (recipient_employee_id, created_at DESC)
;


-- Index for admin queries (all admin-audience notifications)
CREATE INDEX IF NOT EXISTS idx_notifications_audience_created
  ON notifications (audience, created_at DESC)
  WHERE recipient_employee_id IS NULL
;


-- 2. Drop the broad USING(true) policies and replace with scoped ones
DROP POLICY IF EXISTS "read_notifications" ON notifications
;

DROP POLICY IF EXISTS "insert_notifications" ON notifications
;

DROP POLICY IF EXISTS "update_notifications" ON notifications
;

DROP POLICY IF EXISTS "delete_notifications" ON notifications
;

DROP POLICY IF EXISTS "anon_insert_lead_notifications" ON notifications
;


-- Helper: check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.user_id = auth.uid()
      AND r.key IN ('super_admin', 'admin', 'manager')
  )
;

$$
;


GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated
;


-- Helper: get the employee_id for the current user
CREATE OR REPLACE FUNCTION public.current_user_employee_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.employee_id FROM profiles p WHERE p.user_id = auth.uid()
;

$$
;


GRANT EXECUTE ON FUNCTION public.current_user_employee_id() TO authenticated
;


-- SELECT: workers see their own, admins see all
CREATE POLICY "select_own_or_all_notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    recipient_employee_id IS NULL
    OR recipient_employee_id = current_user_employee_id()
    OR is_current_user_admin()
  )
;


-- INSERT: authenticated can insert
CREATE POLICY "insert_notifications_authenticated"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true)
;


-- UPDATE: workers can mark their own as read, admins can update all
CREATE POLICY "update_own_or_all_notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    recipient_employee_id IS NULL
    OR recipient_employee_id = current_user_employee_id()
    OR is_current_user_admin()
  )
  WITH CHECK (
    recipient_employee_id IS NULL
    OR recipient_employee_id = current_user_employee_id()
    OR is_current_user_admin()
  )
;


-- DELETE: admin only
CREATE POLICY "delete_notifications_admin"
  ON notifications FOR DELETE
  TO authenticated
  USING (is_current_user_admin())
;


-- Keep anon insert for public website lead notifications
CREATE POLICY "anon_insert_lead_notifications"
  ON notifications FOR INSERT
  TO anon
  WITH CHECK (true)
;


-- 3. Create trigger function for visit status changes
CREATE OR REPLACE FUNCTION public.notify_visit_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name text
;

  v_employee_name text
;

  v_old_status text
;

  v_new_status text
;

  v_visit_id uuid
;

  v_employee_id uuid
;

  v_contract_id uuid
;

  v_scheduled_date text
;

  v_scheduled_time text
;

  v_package_name text
;

  v_metadata jsonb
;

BEGIN
  v_old_status := COALESCE(OLD.status, '')
;

  v_new_status := COALESCE(NEW.status, '')
;

  v_visit_id := COALESCE(NEW.id, OLD.id)
;

  v_employee_id := COALESCE(NEW.employee_id, OLD.employee_id)
;

  v_contract_id := COALESCE(NEW.contract_id, OLD.contract_id)
;


  -- Get client name and package from contract
  SELECT c.full_name, p.name
  INTO v_client_name, v_package_name
  FROM contracts ct
  LEFT JOIN clients c ON c.id = ct.client_id
  LEFT JOIN packages p ON p.id = ct.package_id
  WHERE ct.id = v_contract_id
;


  v_client_name := COALESCE(v_client_name, 'عميل')
;

  v_scheduled_date := COALESCE(NEW.scheduled_date::text, '')
;

  v_scheduled_time := COALESCE(NEW.scheduled_start_time::text, '')
;


  v_metadata := jsonb_build_object(
    'visit_id', v_visit_id,
    'employee_id', v_employee_id,
    'contract_id', v_contract_id,
    'client_name', v_client_name,
    'scheduled_date', v_scheduled_date,
    'scheduled_time', v_scheduled_time,
    'package_name', v_package_name,
    'old_status', v_old_status,
    'new_status', v_new_status
  )
;


  -- VISIT STARTED → notify admins
  IF v_new_status = 'started' AND v_old_status != 'started' THEN
    SELECT e.full_name INTO v_employee_name FROM employees e WHERE e.id = v_employee_id
;

    v_employee_name := COALESCE(v_employee_name, 'العامل')
;


    INSERT INTO notifications (audience, category, notification_type, title, body, link, read, metadata)
    VALUES (
      'admin',
      'visit',
      'visit_started',
      'بدأ العامل ' || v_employee_name || ' زيارة العميل ' || v_client_name,
      'تم بدء زيارة ' || v_client_name || ' في ' || to_char(now(), 'HH24:MI'),
      '/visits',
      false,
      v_metadata
    )
;


  -- VISIT COMPLETED → notify admins
  ELSIF v_new_status = 'completed' AND v_old_status != 'completed' THEN
    SELECT e.full_name INTO v_employee_name FROM employees e WHERE e.id = v_employee_id
;

    v_employee_name := COALESCE(v_employee_name, 'العامل')
;


    INSERT INTO notifications (audience, category, notification_type, title, body, link, read, metadata)
    VALUES (
      'admin',
      'visit',
      'visit_completed',
      'أنهى العامل ' || v_employee_name || ' زيارة العميل ' || v_client_name,
      'تم إكمال زيارة ' || v_client_name || ' في ' || to_char(now(), 'HH24:MI'),
      '/visits',
      false,
      v_metadata
    )
;


  -- VISIT CANCELLED → notify assigned worker
  ELSIF v_new_status = 'cancelled' AND v_old_status != 'cancelled' AND v_employee_id IS NOT NULL THEN
    INSERT INTO notifications (audience, category, notification_type, recipient_employee_id, title, body, link, read, metadata)
    VALUES (
      'worker',
      'visit',
      'visit_cancelled',
      v_employee_id,
      'تم إلغاء الزيارة',
      'تم إلغاء زيارة العميل ' || v_client_name || ' المقررة في ' || v_scheduled_date,
      '/worker/visits',
      false,
      v_metadata
    )
;


  -- VISIT ASSIGNED (new or reassigned) → notify worker
  ELSIF v_employee_id IS NOT NULL AND (OLD.employee_id IS NULL OR OLD.employee_id != v_employee_id) AND v_new_status != 'cancelled' THEN
    INSERT INTO notifications (audience, category, notification_type, recipient_employee_id, title, body, link, read, metadata)
    VALUES (
      'worker',
      'visit',
      'visit_assigned',
      v_employee_id,
      'زيارة جديدة',
      'تمت إضافة زيارة جديدة لك.' || E'\n' ||
      'العميل: ' || v_client_name || E'\n' ||
      'التاريخ: ' || v_scheduled_date ||
      CASE WHEN v_scheduled_time != '' THEN E'\n' || 'الوقت: ' || v_scheduled_time ELSE '' END ||
      CASE WHEN v_package_name IS NOT NULL AND v_package_name != '' THEN E'\n' || 'الباقة: ' || v_package_name ELSE '' END,
      '/worker/visits',
      false,
      v_metadata
    )
;

  END IF
;


  RETURN COALESCE(NEW, OLD)
;

END
;

$$
;


-- 4. Create trigger on visits table
DROP TRIGGER IF EXISTS trg_notify_visit_status ON visits
;

CREATE TRIGGER trg_notify_visit_status
  AFTER INSERT OR UPDATE OF status, employee_id ON visits
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_visit_status_change()
;


-- 5. Create trigger for visit modifications (non-status fields)
CREATE OR REPLACE FUNCTION public.notify_visit_modified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name text
;

  v_employee_id uuid
;

  v_contract_id uuid
;

  v_changes text[]
;

BEGIN
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW
;

  END IF
;


  -- Only notify if status didn't change AND the visit has an assigned employee
  IF NEW.status = OLD.status AND NEW.employee_id IS NOT NULL AND NEW.employee_id = OLD.employee_id THEN
    v_employee_id := NEW.employee_id
;

    v_contract_id := NEW.contract_id
;


    v_changes := ARRAY[]::text[]
;

    IF NEW.scheduled_date != OLD.scheduled_date THEN
      v_changes := array_append(v_changes, 'التاريخ')
;

    END IF
;

    IF COALESCE(NEW.scheduled_start_time::text, '') != COALESCE(OLD.scheduled_start_time::text, '') THEN
      v_changes := array_append(v_changes, 'الوقت')
;

    END IF
;

    IF NEW.notes != OLD.notes THEN
      v_changes := array_append(v_changes, 'الملاحظات')
;

    END IF
;


    IF array_length(v_changes, 1) IS NULL THEN
      RETURN NEW
;

    END IF
;


    SELECT c.full_name INTO v_client_name
    FROM contracts ct
    LEFT JOIN clients c ON c.id = ct.client_id
    WHERE ct.id = v_contract_id
;

    v_client_name := COALESCE(v_client_name, 'عميل')
;


    INSERT INTO notifications (audience, category, notification_type, recipient_employee_id, title, body, link, read, metadata)
    VALUES (
      'worker',
      'visit',
      'visit_updated',
      v_employee_id,
      'تم تعديل زيارة',
      'تم تعديل موعد زيارة العميل ' || v_client_name || ' (' || array_to_string(v_changes, '، ') || ')',
      '/worker/visits',
      false,
      jsonb_build_object(
        'visit_id', NEW.id,
        'employee_id', v_employee_id,
        'contract_id', v_contract_id,
        'client_name', v_client_name,
        'changes', to_jsonb(v_changes)
      )
    )
;

  END IF
;


  RETURN NEW
;

END
;

$$
;


DROP TRIGGER IF EXISTS trg_notify_visit_modified ON visits
;

CREATE TRIGGER trg_notify_visit_modified
  AFTER UPDATE OF scheduled_date, scheduled_start_time, scheduled_end_time, notes ON visits
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_visit_modified()
;

