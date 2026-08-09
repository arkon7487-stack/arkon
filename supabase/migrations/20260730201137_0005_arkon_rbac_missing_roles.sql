/*
# ARKON RBAC — Add missing roles and permissions

## Summary
Adds sales, customer_service, supervisor, dispatcher roles and seeds their permissions.
*/

-- ===== Add missing roles =====
INSERT INTO roles (key, name, description, is_staff) VALUES
  ('sales', 'موظف مبيعات', 'Sales employee', true),
  ('customer_service', 'خدمة العملاء', 'Customer service representative', true),
  ('supervisor', 'مشرف', 'Field supervisor', true),
  ('dispatcher', 'منسق', 'Dispatcher', true)
ON CONFLICT (key) DO NOTHING;

-- ===== Seed role-permission mappings for new roles =====
DO $$
DECLARE
  r_sales uuid; r_cs uuid; r_supervisor uuid; r_dispatcher uuid;
  perm_id uuid;
BEGIN
  SELECT id INTO r_sales FROM roles WHERE key = 'sales';
  SELECT id INTO r_cs FROM roles WHERE key = 'customer_service';
  SELECT id INTO r_supervisor FROM roles WHERE key = 'supervisor';
  SELECT id INTO r_dispatcher FROM roles WHERE key = 'dispatcher';

  -- Sales: clients, contracts, packages, reports, notifications
  IF r_sales IS NOT NULL THEN
    SELECT id INTO perm_id FROM permissions WHERE key = 'clients';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_sales, perm_id) ON CONFLICT DO NOTHING;
    SELECT id INTO perm_id FROM permissions WHERE key = 'contracts';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_sales, perm_id) ON CONFLICT DO NOTHING;
    SELECT id INTO perm_id FROM permissions WHERE key = 'packages';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_sales, perm_id) ON CONFLICT DO NOTHING;
    SELECT id INTO perm_id FROM permissions WHERE key = 'reports';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_sales, perm_id) ON CONFLICT DO NOTHING;
    SELECT id INTO perm_id FROM permissions WHERE key = 'notifications';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_sales, perm_id) ON CONFLICT DO NOTHING;
  END IF;

  -- Customer Service: clients, visits, notifications
  IF r_cs IS NOT NULL THEN
    SELECT id INTO perm_id FROM permissions WHERE key = 'clients';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_cs, perm_id) ON CONFLICT DO NOTHING;
    SELECT id INTO perm_id FROM permissions WHERE key = 'visits';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_cs, perm_id) ON CONFLICT DO NOTHING;
    SELECT id INTO perm_id FROM permissions WHERE key = 'notifications';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_cs, perm_id) ON CONFLICT DO NOTHING;
  END IF;

  -- Supervisor: employees, visits, reports, notifications
  IF r_supervisor IS NOT NULL THEN
    SELECT id INTO perm_id FROM permissions WHERE key = 'employees';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_supervisor, perm_id) ON CONFLICT DO NOTHING;
    SELECT id INTO perm_id FROM permissions WHERE key = 'visits';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_supervisor, perm_id) ON CONFLICT DO NOTHING;
    SELECT id INTO perm_id FROM permissions WHERE key = 'reports';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_supervisor, perm_id) ON CONFLICT DO NOTHING;
    SELECT id INTO perm_id FROM permissions WHERE key = 'notifications';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_supervisor, perm_id) ON CONFLICT DO NOTHING;
  END IF;

  -- Dispatcher: schedule, visits, calendar, notifications
  IF r_dispatcher IS NOT NULL THEN
    SELECT id INTO perm_id FROM permissions WHERE key = 'schedule';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_dispatcher, perm_id) ON CONFLICT DO NOTHING;
    SELECT id INTO perm_id FROM permissions WHERE key = 'visits';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_dispatcher, perm_id) ON CONFLICT DO NOTHING;
    SELECT id INTO perm_id FROM permissions WHERE key = 'calendar';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_dispatcher, perm_id) ON CONFLICT DO NOTHING;
    SELECT id INTO perm_id FROM permissions WHERE key = 'notifications';
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_dispatcher, perm_id) ON CONFLICT DO NOTHING;
  END IF;
END $$;
