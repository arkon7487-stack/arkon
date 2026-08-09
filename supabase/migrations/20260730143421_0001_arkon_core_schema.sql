/*
# ARKON Core Schema — Enterprise Field Service Management

This migration establishes the foundational, relational schema for the ARKON
Enterprise Field Service Management Platform. ARKON is a single-company system:
the `companies` table holds only ARKON and every operational entity references it
where relevant. The schema is the single source of truth that future Employee and
Client mobile applications will consume through the same API.

## 1. New Tables
### Identity & Access
- `companies` — the single ARKON company record.
- `roles` — system roles (Super Admin, Administrator, Operations Manager,
  Coordinator, HR, Accountant, Field Employee, Client).
- `permissions` — granular permission keys.
- `role_permissions` — many-to-many between roles and permissions.
- `profiles` — links a Supabase Auth user (staff) to a role and employee record.
- `client_otps` — short-lived OTP codes for client phone login.
- `client_sessions` — lightweight client session tokens (phone-only auth).
### People
- `employees` — staff business records (created by admins; auto-linked to auth).
- `clients` — client business records (phone-based login, no password).
### Commercial
- `packages` — master service configuration driving contracts and scheduling.
- `contracts` — independent contract records tied to client, package, employee.
- `contract_attachments` — files attached to a contract.
- `contract_timeline` — immutable audit timeline per contract.
### Operations
- `visits` — scheduled/executed visits derived from contracts and packages.
- `qr_codes` — QR code records tied to visits/contracts.
- `invoices` — invoices tied to contracts.
- `payments` — payments tied to invoices.
### System
- `notifications` — in-app notifications (incl. contract expiration reminders).
- `audit_logs` — system audit trail.
- `activity_timeline` — generic activity feed entries.
- `attachments` — generic file attachments (e.g. client medical files).
- `settings` — key/value system settings.

## 2. Relationships (Foreign Keys)
Every entity carries proper foreign keys. Key links:
- profiles.user_id -> auth.users(id); profiles.role_id -> roles(id);
  profiles.employee_id -> employees(id)
- employees.company_id -> companies(id); clients.company_id -> companies(id)
- contracts.client_id -> clients(id); contracts.package_id -> packages(id);
  contracts.employee_id -> employees(id)
- visits.contract_id -> contracts(id); visits.employee_id -> employees(id)
- qr_codes.visit_id -> visits(id); qr_codes.contract_id -> contracts(id)
- invoices.contract_id -> contracts(id); payments.invoice_id -> invoices(id)
- contract_attachments.contract_id -> contracts(id);
  contract_timeline.contract_id -> contracts(id)
- attachments.client_id -> clients(id) (nullable);
  attachments.contract_id -> contracts(id) (nullable)

## 3. Security (RLS)
RLS enabled on every table. ARKON is a single internal platform: staff tables
readable/writable by authenticated staff. Client OTP/session tables are
anon+authenticated CRUD to support the phone login flow. `clients` readable by
anon+authenticated so the phone-login flow works end to end; writes restricted
to authenticated staff.

## 4. Notes
- Contract immutability after activation is enforced in the service layer.
- Contract number auto-generated via a sequence-backed default.
- All timestamps timestamptz defaulting to now().
- Idempotent: IF NOT EXISTS; policies dropped before recreate.
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== COMPANIES =====
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  tax_id text,
  address text,
  phone text,
  email text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_read_companies" ON companies;
CREATE POLICY "staff_read_companies" ON companies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff_write_companies" ON companies;
CREATE POLICY "staff_write_companies" ON companies FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "staff_update_companies" ON companies;
CREATE POLICY "staff_update_companies" ON companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ===== ROLES =====
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_staff boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_roles" ON roles;
CREATE POLICY "read_roles" ON roles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "write_roles" ON roles;
CREATE POLICY "write_roles" ON roles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_roles" ON roles;
CREATE POLICY "update_roles" ON roles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ===== PERMISSIONS =====
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_permissions" ON permissions;
CREATE POLICY "read_permissions" ON permissions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "write_permissions" ON permissions;
CREATE POLICY "write_permissions" ON permissions FOR INSERT TO authenticated WITH CHECK (true);

-- ===== ROLE_PERMISSIONS =====
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_role_permissions" ON role_permissions;
CREATE POLICY "read_role_permissions" ON role_permissions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "write_role_permissions" ON role_permissions;
CREATE POLICY "write_role_permissions" ON role_permissions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "delete_role_permissions" ON role_permissions;
CREATE POLICY "delete_role_permissions" ON role_permissions FOR DELETE TO authenticated USING (true);

-- ===== EMPLOYEES =====
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  phone_number text NOT NULL,
  national_id text,
  age int,
  gender text,
  address text,
  service_area text,
  employment_date date,
  department text,
  position text,
  working_hours text,
  employment_status text NOT NULL DEFAULT 'active',
  photo_url text,
  emergency_contact text,
  username text UNIQUE,
  auth_email text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_employees" ON employees;
CREATE POLICY "read_employees" ON employees FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_employees" ON employees;
CREATE POLICY "insert_employees" ON employees FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_employees" ON employees;
CREATE POLICY "update_employees" ON employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_employees" ON employees;
CREATE POLICY "delete_employees" ON employees FOR DELETE TO authenticated USING (true);

-- ===== PROFILES =====
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_profiles" ON profiles;
CREATE POLICY "read_profiles" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_profiles" ON profiles;
CREATE POLICY "insert_profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_profiles" ON profiles;
CREATE POLICY "update_profiles" ON profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ===== CLIENTS =====
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  phone_number text NOT NULL,
  email text,
  address text,
  service_area text,
  date_of_birth date,
  gender text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone_number);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_clients" ON clients;
CREATE POLICY "read_clients" ON clients FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_clients" ON clients;
CREATE POLICY "insert_clients" ON clients FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_clients" ON clients;
CREATE POLICY "update_clients" ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_clients" ON clients;
CREATE POLICY "delete_clients" ON clients FOR DELETE TO authenticated USING (true);

-- ===== CLIENT OTPS =====
CREATE TABLE IF NOT EXISTS client_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_otps_phone ON client_otps(phone_number);
ALTER TABLE client_otps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rw_client_otps_sel" ON client_otps;
CREATE POLICY "rw_client_otps_sel" ON client_otps FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "rw_client_otps_ins" ON client_otps;
CREATE POLICY "rw_client_otps_ins" ON client_otps FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rw_client_otps_upd" ON client_otps;
CREATE POLICY "rw_client_otps_upd" ON client_otps FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rw_client_otps_del" ON client_otps;
CREATE POLICY "rw_client_otps_del" ON client_otps FOR DELETE TO anon, authenticated USING (true);

-- ===== CLIENT SESSIONS =====
CREATE TABLE IF NOT EXISTS client_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_sessions_token ON client_sessions(token);
ALTER TABLE client_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rw_client_sessions_sel" ON client_sessions;
CREATE POLICY "rw_client_sessions_sel" ON client_sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "rw_client_sessions_ins" ON client_sessions;
CREATE POLICY "rw_client_sessions_ins" ON client_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rw_client_sessions_upd" ON client_sessions;
CREATE POLICY "rw_client_sessions_upd" ON client_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rw_client_sessions_del" ON client_sessions;
CREATE POLICY "rw_client_sessions_del" ON client_sessions FOR DELETE TO anon, authenticated USING (true);

-- ===== PACKAGES =====
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  category text,
  description text,
  contract_duration_weeks int,
  visits_per_week numeric,
  total_visits int,
  visit_duration_minutes int,
  default_visit_start_time time,
  default_visit_end_time time,
  included_services text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  final_price numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  terms text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_packages" ON packages;
CREATE POLICY "read_packages" ON packages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_packages" ON packages;
CREATE POLICY "insert_packages" ON packages FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_packages" ON packages;
CREATE POLICY "update_packages" ON packages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_packages" ON packages;
CREATE POLICY "delete_packages" ON packages FOR DELETE TO authenticated USING (true);

-- ===== CONTRACTS =====
CREATE SEQUENCE IF NOT EXISTS contract_number_seq START 1;
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  contract_number text NOT NULL UNIQUE DEFAULT ('CT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('contract_number_seq')::text, 5, '0')),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  package_id uuid NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  contract_duration_weeks int,
  status text NOT NULL DEFAULT 'draft',
  price numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  final_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  remaining_balance numeric(12,2) NOT NULL DEFAULT 0,
  signed_contract_url text,
  notes text,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_package ON contracts(package_id);
CREATE INDEX IF NOT EXISTS idx_contracts_employee ON contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_contracts" ON contracts;
CREATE POLICY "read_contracts" ON contracts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_contracts" ON contracts;
CREATE POLICY "insert_contracts" ON contracts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_contracts" ON contracts;
CREATE POLICY "update_contracts" ON contracts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_contracts" ON contracts;
CREATE POLICY "delete_contracts" ON contracts FOR DELETE TO authenticated USING (true);

-- ===== CONTRACT ATTACHMENTS =====
CREATE TABLE IF NOT EXISTS contract_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE contract_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_contract_attachments" ON contract_attachments;
CREATE POLICY "read_contract_attachments" ON contract_attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_contract_attachments" ON contract_attachments;
CREATE POLICY "insert_contract_attachments" ON contract_attachments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "delete_contract_attachments" ON contract_attachments;
CREATE POLICY "delete_contract_attachments" ON contract_attachments FOR DELETE TO authenticated USING (true);

-- ===== CONTRACT TIMELINE =====
CREATE TABLE IF NOT EXISTS contract_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text NOT NULL,
  meta jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_timeline_contract ON contract_timeline(contract_id, created_at);
ALTER TABLE contract_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_contract_timeline" ON contract_timeline;
CREATE POLICY "read_contract_timeline" ON contract_timeline FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_contract_timeline" ON contract_timeline;
CREATE POLICY "insert_contract_timeline" ON contract_timeline FOR INSERT TO authenticated WITH CHECK (true);

-- ===== VISITS =====
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  scheduled_start_time time,
  scheduled_end_time time,
  status text NOT NULL DEFAULT 'scheduled',
  visit_duration_minutes int,
  qr_code_id uuid,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visits_contract ON visits(contract_id);
CREATE INDEX IF NOT EXISTS idx_visits_employee ON visits(employee_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_visits" ON visits;
CREATE POLICY "read_visits" ON visits FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_visits" ON visits;
CREATE POLICY "insert_visits" ON visits FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_visits" ON visits;
CREATE POLICY "update_visits" ON visits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_visits" ON visits;
CREATE POLICY "delete_visits" ON visits FOR DELETE TO authenticated USING (true);

-- ===== QR CODES =====
CREATE TABLE IF NOT EXISTS qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  code_value text NOT NULL UNIQUE,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_qr_codes" ON qr_codes;
CREATE POLICY "read_qr_codes" ON qr_codes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_qr_codes" ON qr_codes;
CREATE POLICY "insert_qr_codes" ON qr_codes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_qr_codes" ON qr_codes;
CREATE POLICY "update_qr_codes" ON qr_codes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_qr_codes" ON qr_codes;
CREATE POLICY "delete_qr_codes" ON qr_codes FOR DELETE TO authenticated USING (true);

-- ===== INVOICES =====
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'issued',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices(contract_id);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_invoices" ON invoices;
CREATE POLICY "read_invoices" ON invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_invoices" ON invoices;
CREATE POLICY "insert_invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_invoices" ON invoices;
CREATE POLICY "update_invoices" ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_invoices" ON invoices;
CREATE POLICY "delete_invoices" ON invoices FOR DELETE TO authenticated USING (true);

-- ===== PAYMENTS =====
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  method text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_payments" ON payments;
CREATE POLICY "read_payments" ON payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_payments" ON payments;
CREATE POLICY "insert_payments" ON payments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "delete_payments" ON payments;
CREATE POLICY "delete_payments" ON payments FOR DELETE TO authenticated USING (true);

-- ===== NOTIFICATIONS =====
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  audience text,
  category text,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_notifications" ON notifications;
CREATE POLICY "read_notifications" ON notifications FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_notifications" ON notifications;
CREATE POLICY "insert_notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_notifications" ON notifications;
CREATE POLICY "update_notifications" ON notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_notifications" ON notifications;
CREATE POLICY "delete_notifications" ON notifications FOR DELETE TO authenticated USING (true);

-- ===== AUDIT LOGS =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_audit_logs" ON audit_logs;
CREATE POLICY "read_audit_logs" ON audit_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ===== ACTIVITY TIMELINE =====
CREATE TABLE IF NOT EXISTS activity_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_timeline(entity_type, entity_id, created_at);
ALTER TABLE activity_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_activity_timeline" ON activity_timeline;
CREATE POLICY "read_activity_timeline" ON activity_timeline FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_activity_timeline" ON activity_timeline;
CREATE POLICY "insert_activity_timeline" ON activity_timeline FOR INSERT TO authenticated WITH CHECK (true);

-- ===== ATTACHMENTS =====
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_client ON attachments(client_id);
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_attachments" ON attachments;
CREATE POLICY "read_attachments" ON attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_attachments" ON attachments;
CREATE POLICY "insert_attachments" ON attachments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "delete_attachments" ON attachments;
CREATE POLICY "delete_attachments" ON attachments FOR DELETE TO authenticated USING (true);

-- ===== SETTINGS =====
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_settings" ON settings;
CREATE POLICY "read_settings" ON settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_settings" ON settings;
CREATE POLICY "write_settings" ON settings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_settings" ON settings;
CREATE POLICY "update_settings" ON settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ===== SEED =====
INSERT INTO companies (id, name, legal_name, address, email)
VALUES ('11111111-1111-1111-1111-111111111111', 'ARKON', 'ARKON Enterprise', 'ARKON Headquarters', 'info@arkon.enterprise')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO roles (key, name, description, is_staff) VALUES
  ('super_admin', 'Super Admin', 'Full system access', true),
  ('administrator', 'Administrator', 'Manages users, clients, contracts', true),
  ('operations_manager', 'Operations Manager', 'Manages schedules and visits', true),
  ('coordinator', 'Coordinator', 'Coordinates daily operations', true),
  ('hr', 'HR', 'Manages employees', true),
  ('accountant', 'Accountant', 'Manages invoices and payments', true),
  ('field_employee', 'Field Employee', 'Executes visits', true),
  ('client', 'Client', 'Client portal access', false)
ON CONFLICT (key) DO NOTHING;
