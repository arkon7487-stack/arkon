-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260730195949_0004_arkon_rbac

/*
# ARKON RBAC — Role-Based Access Control

## Summary
Updates the existing permissions table with Arabic labels and categories,
seeds all permissions, and seeds role-permission mappings using the existing
role_permissions table (which uses permission_id uuid FK).

## Modified Tables
- `permissions` — adds `label` and `category` columns

## Seeded Data
- All 23 permission keys with Arabic labels
- Role-permission mappings for all 10 roles
*/

-- ===== Add label and category to permissions =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permissions' AND column_name = 'label') THEN
    ALTER TABLE permissions ADD COLUMN label text
;

  END IF
;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permissions' AND column_name = 'category') THEN
    ALTER TABLE permissions ADD COLUMN category text NOT NULL DEFAULT 'staff'
;

  END IF
;

END $$
;


-- ===== Seed Permissions =====
INSERT INTO permissions (key, label, category, description) VALUES
  ('dashboard', 'لوحة التحكم', 'staff', 'Full admin dashboard'),
  ('employees', 'الموظفون', 'staff', 'Employee management'),
  ('clients', 'العملاء', 'staff', 'Customer management'),
  ('packages', 'الباقات', 'staff', 'Package templates'),
  ('contracts', 'العقود', 'staff', 'Contract management'),
  ('visits', 'الزيارات', 'staff', 'Visit management'),
  ('invoices', 'الفواتير', 'staff', 'Invoice management'),
  ('schedule', 'الجدولة', 'staff', 'Scheduling engine'),
  ('calendar', 'التقويم', 'staff', 'Calendar view'),
  ('reports', 'التقارير', 'staff', 'Reports and analytics'),
  ('audit', 'سجل النشاط', 'staff', 'Audit log'),
  ('notifications', 'الإشعارات', 'staff', 'System notifications'),
  ('settings', 'الإعدادات', 'staff', 'System configuration'),
  ('portal', 'بوابة الموظف', 'staff', 'Employee portal'),
  ('worker_home', 'الصفحة الرئيسية', 'worker', 'Worker home'),
  ('worker_visits', 'زيارات اليوم', 'worker', 'Worker today visits'),
  ('worker_qr', 'مسح QR', 'worker', 'QR scanner'),
  ('worker_profile', 'الملف الشخصي', 'worker', 'Worker profile'),
  ('client_home', 'الصفحة الرئيسية', 'client', 'Customer home'),
  ('client_visits', 'الزيارات', 'client', 'Customer visits'),
  ('client_invoices', 'الفواتير', 'client', 'Customer invoices'),
  ('client_support', 'الدعم', 'client', 'Customer support'),
  ('client_profile', 'الملف الشخصي', 'client', 'Customer profile')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description
;


-- ===== Seed Role-Permission Mappings =====
DO $$
DECLARE
  r_super_admin uuid
;
 r_admin uuid
;
 r_ops uuid
;
 r_field uuid
;

  r_sales uuid
;
 r_cs uuid
;
 r_accountant uuid
;
 r_supervisor uuid
;

  r_dispatcher uuid
;
 r_hr uuid
;

  perm_id uuid
;

BEGIN
  SELECT id INTO r_super_admin FROM roles WHERE key = 'super_admin'
;

  SELECT id INTO r_admin FROM roles WHERE key = 'administrator'
;

  SELECT id INTO r_ops FROM roles WHERE key = 'operations_manager'
;

  SELECT id INTO r_field FROM roles WHERE key = 'field_employee'
;

  SELECT id INTO r_sales FROM roles WHERE key = 'sales'
;

  SELECT id INTO r_cs FROM roles WHERE key = 'customer_service'
;

  SELECT id INTO r_accountant FROM roles WHERE key = 'accountant'
;

  SELECT id INTO r_supervisor FROM roles WHERE key = 'supervisor'
;

  SELECT id INTO r_dispatcher FROM roles WHERE key = 'dispatcher'
;

  SELECT id INTO r_hr FROM roles WHERE key = 'hr'
;


  -- Super Admin & Administrator: all staff permissions
  IF r_super_admin IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_super_admin, p.id FROM permissions p WHERE p.category = 'staff'
    ON CONFLICT DO NOTHING
;

  END IF
;

  IF r_admin IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_admin, p.id FROM permissions p WHERE p.category = 'staff'
    ON CONFLICT DO NOTHING
;

  END IF
;


  -- Operations Manager
  IF r_ops IS NOT NULL THEN
    SELECT id INTO perm_id FROM permissions WHERE key = 'dashboard'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_ops, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'clients'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_ops, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'contracts'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_ops, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'visits'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_ops, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'schedule'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_ops, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'calendar'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_ops, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'reports'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_ops, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'notifications'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_ops, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'packages'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_ops, perm_id) ON CONFLICT DO NOTHING
;

  END IF
;


  -- Field Worker
  IF r_field IS NOT NULL THEN
    SELECT id INTO perm_id FROM permissions WHERE key = 'worker_home'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_field, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'worker_visits'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_field, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'worker_qr'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_field, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'worker_profile'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_field, perm_id) ON CONFLICT DO NOTHING
;

  END IF
;


  -- Sales
  IF r_sales IS NOT NULL THEN
    SELECT id INTO perm_id FROM permissions WHERE key = 'clients'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_sales, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'contracts'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_sales, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'packages'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_sales, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'reports'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_sales, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'notifications'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_sales, perm_id) ON CONFLICT DO NOTHING
;

  END IF
;


  -- Customer Service
  IF r_cs IS NOT NULL THEN
    SELECT id INTO perm_id FROM permissions WHERE key = 'clients'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_cs, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'visits'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_cs, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'notifications'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_cs, perm_id) ON CONFLICT DO NOTHING
;

  END IF
;


  -- Accountant
  IF r_accountant IS NOT NULL THEN
    SELECT id INTO perm_id FROM permissions WHERE key = 'invoices'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_accountant, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'contracts'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_accountant, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'reports'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_accountant, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'notifications'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_accountant, perm_id) ON CONFLICT DO NOTHING
;

  END IF
;


  -- Supervisor
  IF r_supervisor IS NOT NULL THEN
    SELECT id INTO perm_id FROM permissions WHERE key = 'employees'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_supervisor, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'visits'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_supervisor, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'reports'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_supervisor, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'notifications'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_supervisor, perm_id) ON CONFLICT DO NOTHING
;

  END IF
;


  -- Dispatcher
  IF r_dispatcher IS NOT NULL THEN
    SELECT id INTO perm_id FROM permissions WHERE key = 'schedule'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_dispatcher, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'visits'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_dispatcher, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'calendar'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_dispatcher, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'notifications'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_dispatcher, perm_id) ON CONFLICT DO NOTHING
;

  END IF
;


  -- HR
  IF r_hr IS NOT NULL THEN
    SELECT id INTO perm_id FROM permissions WHERE key = 'employees'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_hr, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'reports'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_hr, perm_id) ON CONFLICT DO NOTHING
;

    SELECT id INTO perm_id FROM permissions WHERE key = 'notifications'
;

    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_hr, perm_id) ON CONFLICT DO NOTHING
;

  END IF
;

END $$
;

