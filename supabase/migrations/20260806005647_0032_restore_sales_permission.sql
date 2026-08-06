/*
# Fix: Restore missing 'sales' permission in RBAC

## Root Cause
Migration 0011 (Sales CRM) created the `leads` and `lead_activities` tables
and the `sales` role, but never inserted a `sales` permission into the
`permissions` table. The sidebar filters nav items by `hasPermission('sales')`,
which returned false for every user since the permission row didn't exist.
This caused the Sales module to disappear from the sidebar for all roles,
including super_admin (super_admin bypasses the check in code, but other
roles like administrator, operations_manager, supervisor, and the sales
role itself were affected).

## Fix
1. Insert the `sales` permission into the `permissions` table.
2. Assign it to the same roles that already have `opportunities`:
   administrator, operations_manager, sales, super_admin, supervisor.
   This mirrors the existing pattern for sibling business modules.
*/

-- 1. Insert the missing permission (idempotent)
INSERT INTO permissions (key, label, category)
VALUES ('sales', 'المبيعات', 'staff')
ON CONFLICT (key) DO NOTHING;

-- 2. Assign to roles that have 'opportunities' (idempotent)
DO $$
DECLARE
  p_sales uuid;
  r record;
BEGIN
  SELECT id INTO p_sales FROM permissions WHERE key = 'sales';
  IF p_sales IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT rp.role_id
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE p.key = 'opportunities'
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (r.role_id, p_sales)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
