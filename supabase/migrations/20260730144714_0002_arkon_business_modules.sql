/*
# ARKON Core Business Modules — Schema Extension

Extends the foundational schema to support the full business module set:
employee leave/availability, visit lifecycle, QR-per-client, audit enrichment,
client medical/emergency info, and scheduling constraints.

## 1. New Tables
- `employee_leave` — leave/vacation records per employee (start/end, type, status).
- `employee_availability` — recurring weekly availability windows per employee.
- `client_medical` — medical information per client (conditions, allergies, notes).
- `client_emergency_contacts` — emergency contact records per client.

## 2. Modified Tables
### employees
- add `skills` (text) — comma-separated skill tags for scheduling.
- add `max_daily_visits` (int, default 8) — daily visit cap.
- add `max_weekly_visits` (int, default 40) — weekly visit cap.
- add `latitude` (double) / `longitude` (double) — employee base location.
- add `availability_status` (text, default 'available') — quick availability flag.

### clients
- add `medical_conditions` (text).
- add `allergies` (text).
- add `blood_type` (text).
- add `emergency_contact_name` (text).
- add `emergency_contact_phone` (text).
- add `emergency_contact_relation` (text).
- add `latitude` (double) / `longitude` (double).

### visits
- add `started_at` (timestamptz) — first scan timestamp.
- add `finished_at` (timestamptz) — second scan timestamp.
- add `start_gps_lat` / `start_gps_lng` (double precision).
- add `end_gps_lat` / `end_gps_lng` (double precision).
- add `visit_index` (int) — sequence number within the contract.
- add `assigned_at` (timestamptz).
- add `archived_at` (timestamptz).

### qr_codes
- add `client_id` (uuid) — QR is generated per client; visits reference it.

### audit_logs
- add `ip_address` (text).
- add `old_value` (jsonb).
- add `new_value` (jsonb).

## 3. Security
RLS enabled on all new tables with anon+authenticated or authenticated policies
matching the existing single-internal-platform pattern.

## 4. Notes
- Idempotent: uses DO $$ blocks for conditional column adds.
- No data is dropped or renamed.
*/

-- ===== EMPLOYEE LEAVE =====
CREATE TABLE IF NOT EXISTS employee_leave (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'leave',
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_leave_emp ON employee_leave(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_dates ON employee_leave(start_date, end_date);
ALTER TABLE employee_leave ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_employee_leave" ON employee_leave;
CREATE POLICY "read_employee_leave" ON employee_leave FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_employee_leave" ON employee_leave;
CREATE POLICY "insert_employee_leave" ON employee_leave FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_employee_leave" ON employee_leave;
CREATE POLICY "update_employee_leave" ON employee_leave FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_employee_leave" ON employee_leave;
CREATE POLICY "delete_employee_leave" ON employee_leave FOR DELETE TO authenticated USING (true);

-- ===== EMPLOYEE AVAILABILITY =====
CREATE TABLE IF NOT EXISTS employee_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_avail_emp ON employee_availability(employee_id);
ALTER TABLE employee_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_employee_availability" ON employee_availability;
CREATE POLICY "read_employee_availability" ON employee_availability FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_employee_availability" ON employee_availability;
CREATE POLICY "insert_employee_availability" ON employee_availability FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_employee_availability" ON employee_availability;
CREATE POLICY "update_employee_availability" ON employee_availability FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_employee_availability" ON employee_availability;
CREATE POLICY "delete_employee_availability" ON employee_availability FOR DELETE TO authenticated USING (true);

-- ===== CLIENT MEDICAL =====
CREATE TABLE IF NOT EXISTS client_medical (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  medical_conditions text,
  allergies text,
  blood_type text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE client_medical ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_client_medical" ON client_medical;
CREATE POLICY "read_client_medical" ON client_medical FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_client_medical" ON client_medical;
CREATE POLICY "insert_client_medical" ON client_medical FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_client_medical" ON client_medical;
CREATE POLICY "update_client_medical" ON client_medical FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ===== CLIENT EMERGENCY CONTACTS =====
CREATE TABLE IF NOT EXISTS client_emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  relation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_emergency_client ON client_emergency_contacts(client_id);
ALTER TABLE client_emergency_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_client_emergency_contacts" ON client_emergency_contacts;
CREATE POLICY "read_client_emergency_contacts" ON client_emergency_contacts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_client_emergency_contacts" ON client_emergency_contacts;
CREATE POLICY "insert_client_emergency_contacts" ON client_emergency_contacts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_client_emergency_contacts" ON client_emergency_contacts;
CREATE POLICY "update_client_emergency_contacts" ON client_emergency_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_client_emergency_contacts" ON client_emergency_contacts;
CREATE POLICY "delete_client_emergency_contacts" ON client_emergency_contacts FOR DELETE TO authenticated USING (true);

-- ===== EMPLOYEE COLUMNS =====
DO $$ BEGIN
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS skills text;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS max_daily_visits int NOT NULL DEFAULT 8;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS max_weekly_visits int NOT NULL DEFAULT 40;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS latitude double precision;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS longitude double precision;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'available';
END $$;

-- ===== CLIENT COLUMNS =====
DO $$ BEGIN
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS medical_conditions text;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS allergies text;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS blood_type text;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS emergency_contact_name text;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS emergency_contact_relation text;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS latitude double precision;
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS longitude double precision;
END $$;

-- ===== VISIT COLUMNS =====
DO $$ BEGIN
  ALTER TABLE visits ADD COLUMN IF NOT EXISTS started_at timestamptz;
  ALTER TABLE visits ADD COLUMN IF NOT EXISTS finished_at timestamptz;
  ALTER TABLE visits ADD COLUMN IF NOT EXISTS start_gps_lat double precision;
  ALTER TABLE visits ADD COLUMN IF NOT EXISTS start_gps_lng double precision;
  ALTER TABLE visits ADD COLUMN IF NOT EXISTS end_gps_lat double precision;
  ALTER TABLE visits ADD COLUMN IF NOT EXISTS end_gps_lng double precision;
  ALTER TABLE visits ADD COLUMN IF NOT EXISTS visit_index int;
  ALTER TABLE visits ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
  ALTER TABLE visits ADD COLUMN IF NOT EXISTS archived_at timestamptz;
END $$;

-- ===== QR CODE COLUMNS =====
DO $$ BEGIN
  ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE CASCADE;
END $$;

-- ===== AUDIT LOG COLUMNS =====
DO $$ BEGIN
  ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address text;
  ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value jsonb;
  ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value jsonb;
END $$;
