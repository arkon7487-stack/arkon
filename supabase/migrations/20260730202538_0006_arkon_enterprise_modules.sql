/*
# ARKON Enterprise Modules — Inventory, Opportunities, Financial Management

## Summary
Adds three new enterprise modules to the ARKON platform:
1. **Inventory Management** — categories, items, stock movements, worker equipment assignments
2. **Opportunities (Lead Management)** — sales pipeline for potential customers
3. **Financial Management** — expenses, accounts receivable tracking

## New Tables

### Inventory Module
- `inventory_categories` — unlimited categories (Cleaning Chemicals, Equipment, etc.)
- `inventory_items` — individual stock items with SKU, quantities, prices, supplier, location
- `inventory_movements` — log of every stock movement (purchase, assignment, return, damaged, etc.)
- `inventory_assignments` — equipment assigned to field workers

### Opportunities Module
- `opportunities` — lead/prospect records with status pipeline (New → Contacted → Qualified → Converted → Rejected/Closed)

### Financial Module
- `expenses` — manual expense records with categories, vendor, payment method, receipt

## New Permissions
- `inventory` — manage inventory
- `opportunities` — view/manage sales leads
- `finance` — full financial management access

## Modified Tables
- None modified. All new tables reference existing `companies`, `employees`, `clients`, `contracts` via foreign keys.

## Security
- RLS enabled on all new tables
- CRUD policies scoped to `authenticated` users (staff app with sign-in)
*/

-- ===== PERMISSIONS =====
INSERT INTO permissions (key, label, category) VALUES
  ('inventory', 'المخزون', 'staff'),
  ('opportunities', 'الفرص', 'staff'),
  ('finance', 'الإدارة المالية', 'staff')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to roles
DO $$
DECLARE
  r_admin uuid; r_super uuid; r_ops uuid; r_sales uuid; r_accountant uuid; r_supervisor uuid;
  p_inv uuid; p_opp uuid; p_fin uuid;
BEGIN
  SELECT id INTO r_admin FROM roles WHERE key = 'administrator';
  SELECT id INTO r_super FROM roles WHERE key = 'super_admin';
  SELECT id INTO r_ops FROM roles WHERE key = 'operations_manager';
  SELECT id INTO r_sales FROM roles WHERE key = 'sales';
  SELECT id INTO r_accountant FROM roles WHERE key = 'accountant';
  SELECT id INTO r_supervisor FROM roles WHERE key = 'supervisor';

  SELECT id INTO p_inv FROM permissions WHERE key = 'inventory';
  SELECT id INTO p_opp FROM permissions WHERE key = 'opportunities';
  SELECT id INTO p_fin FROM permissions WHERE key = 'finance';

  -- Admin & super_admin get all three
  IF r_admin IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_admin, p_inv), (r_admin, p_opp), (r_admin, p_fin) ON CONFLICT DO NOTHING;
  END IF;
  IF r_super IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_super, p_inv), (r_super, p_opp), (r_super, p_fin) ON CONFLICT DO NOTHING;
  END IF;

  -- Operations manager: inventory + opportunities
  IF r_ops IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_ops, p_inv), (r_ops, p_opp) ON CONFLICT DO NOTHING;
  END IF;

  -- Sales: opportunities only
  IF r_sales IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_sales, p_opp) ON CONFLICT DO NOTHING;
  END IF;

  -- Accountant: finance only
  IF r_accountant IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_accountant, p_fin) ON CONFLICT DO NOTHING;
  END IF;

  -- Supervisor: inventory + opportunities (view)
  IF r_supervisor IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id) VALUES (r_supervisor, p_inv), (r_supervisor, p_opp) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ===== INVENTORY CATEGORIES =====
CREATE TABLE IF NOT EXISTS inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_inv_cat_company ON inventory_categories(company_id);

DROP POLICY IF EXISTS "select_inv_cat" ON inventory_categories;
CREATE POLICY "select_inv_cat" ON inventory_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_inv_cat" ON inventory_categories;
CREATE POLICY "insert_inv_cat" ON inventory_categories FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_inv_cat" ON inventory_categories;
CREATE POLICY "update_inv_cat" ON inventory_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_inv_cat" ON inventory_categories;
CREATE POLICY "delete_inv_cat" ON inventory_categories FOR DELETE TO authenticated USING (true);

-- ===== INVENTORY ITEMS =====
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id uuid REFERENCES inventory_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  description text,
  unit text DEFAULT 'piece',
  quantity numeric NOT NULL DEFAULT 0,
  min_quantity numeric NOT NULL DEFAULT 0,
  purchase_price numeric NOT NULL DEFAULT 0,
  selling_price numeric DEFAULT 0,
  supplier text,
  storage_location text,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_inv_items_company ON inventory_items(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_sku ON inventory_items(sku);

DROP POLICY IF EXISTS "select_inv_items" ON inventory_items;
CREATE POLICY "select_inv_items" ON inventory_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_inv_items" ON inventory_items;
CREATE POLICY "insert_inv_items" ON inventory_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_inv_items" ON inventory_items;
CREATE POLICY "update_inv_items" ON inventory_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_inv_items" ON inventory_items;
CREATE POLICY "delete_inv_items" ON inventory_items FOR DELETE TO authenticated USING (true);

-- ===== INVENTORY MOVEMENTS =====
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  quantity numeric NOT NULL,
  reason text,
  notes text,
  user_id uuid,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_inv_mov_item ON inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_created ON inventory_movements(created_at DESC);

DROP POLICY IF EXISTS "select_inv_mov" ON inventory_movements;
CREATE POLICY "select_inv_mov" ON inventory_movements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_inv_mov" ON inventory_movements;
CREATE POLICY "insert_inv_mov" ON inventory_movements FOR INSERT TO authenticated WITH CHECK (true);

-- ===== INVENTORY ASSIGNMENTS (worker equipment) =====
CREATE TABLE IF NOT EXISTS inventory_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'assigned',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz,
  notes text
);
ALTER TABLE inventory_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_inv_asgn_emp ON inventory_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_inv_asgn_item ON inventory_assignments(item_id);

DROP POLICY IF EXISTS "select_inv_asgn" ON inventory_assignments;
CREATE POLICY "select_inv_asgn" ON inventory_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_inv_asgn" ON inventory_assignments;
CREATE POLICY "insert_inv_asgn" ON inventory_assignments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_inv_asgn" ON inventory_assignments;
CREATE POLICY "update_inv_asgn" ON inventory_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_inv_asgn" ON inventory_assignments;
CREATE POLICY "delete_inv_asgn" ON inventory_assignments FOR DELETE TO authenticated USING (true);

-- ===== OPPORTUNITIES =====
CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  phone_number text NOT NULL,
  alt_phone text,
  address text,
  city text,
  location_link text,
  interested_service text,
  expected_budget numeric,
  lead_source text,
  notes text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'new',
  created_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  converted_client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  converted_contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_opp_company ON opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opp_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opp_created_by ON opportunities(created_by);

DROP POLICY IF EXISTS "select_opp" ON opportunities;
CREATE POLICY "select_opp" ON opportunities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_opp" ON opportunities;
CREATE POLICY "insert_opp" ON opportunities FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_opp" ON opportunities;
CREATE POLICY "update_opp" ON opportunities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_opp" ON opportunities;
CREATE POLICY "delete_opp" ON opportunities FOR DELETE TO authenticated USING (true);

-- ===== EXPENSES =====
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor text,
  description text,
  receipt_url text,
  entered_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exp_company ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_exp_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_exp_category ON expenses(category);

DROP POLICY IF EXISTS "select_exp" ON expenses;
CREATE POLICY "select_exp" ON expenses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_exp" ON expenses;
CREATE POLICY "insert_exp" ON expenses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_exp" ON expenses;
CREATE POLICY "update_exp" ON expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_exp" ON expenses;
CREATE POLICY "delete_exp" ON expenses FOR DELETE TO authenticated USING (true);
