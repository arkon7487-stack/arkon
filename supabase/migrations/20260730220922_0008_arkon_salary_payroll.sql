/*
# ARKON — Employee Salary & Monthly Payroll Engine

## Summary
Adds salary management to employees and creates a monthly payroll engine.
Each month, the system generates salary payables for active employees.
When marked as paid, the payable is removed from the pending list and
recorded permanently as an expense in the finance archive.

## Modified Tables
- `employees`
  - `monthly_salary` (numeric, nullable) — the employee's monthly salary
  - `salary_type` (text, default 'monthly') — monthly / weekly / daily
  - `salary_effective_date` (date, nullable) — when the salary takes effect
  - `salary_notes` (text, nullable) — optional notes about the salary

## New Tables
- `payroll`
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK to companies)
  - `employee_id` (uuid, FK to employees)
  - `salary_amount` (numeric, not null) — the salary at the time of generation
  - `salary_month` (text, not null) — e.g. '2026-07'
  - `due_date` (date, not null) — when the salary is due
  - `status` (text, not null, default 'pending') — pending / paid / overdue
  - `paid_at` (timestamptz, nullable) — when the salary was paid
  - `paid_by` (text, nullable) — who processed the payment
  - `payment_notes` (text, nullable) — optional payment notes
  - `expense_id` (uuid, nullable, FK to expenses) — linked expense record after payment
  - `created_at`, `updated_at` (timestamptz)

## Security
- RLS enabled on `payroll`.
- CRUD policies for anon + authenticated (single-tenant app uses anon key).
*/

-- Add salary columns to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS monthly_salary numeric(12, 2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_type text NOT NULL DEFAULT 'monthly';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_effective_date date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_notes text;

-- Create payroll table
CREATE TABLE IF NOT EXISTS payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  salary_amount numeric(12, 2) NOT NULL,
  salary_month text NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  paid_by text,
  payment_notes text,
  expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month ON payroll(salary_month);
CREATE INDEX IF NOT EXISTS idx_payroll_status ON payroll(status);
CREATE INDEX IF NOT EXISTS idx_payroll_company ON payroll(company_id);

-- Unique constraint: one payable per employee per month
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_employee_month_unique'
  ) THEN
    ALTER TABLE payroll ADD CONSTRAINT payroll_employee_month_unique UNIQUE (employee_id, salary_month);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "anon_select_payroll" ON payroll;
CREATE POLICY "anon_select_payroll" ON payroll FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payroll" ON payroll;
CREATE POLICY "anon_insert_payroll" ON payroll FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payroll" ON payroll;
CREATE POLICY "anon_update_payroll" ON payroll FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_payroll" ON payroll;
CREATE POLICY "anon_delete_payroll" ON payroll FOR DELETE
  TO anon, authenticated USING (true);
