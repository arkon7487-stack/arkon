/*
# ARKON — Add employee_id to expenses

## Summary
Adds an `employee_id` column to the `expenses` table so that salary
expenses created by the payroll engine can be linked back to the employee.

## Modified Tables
- `expenses`
  - `employee_id` (uuid, nullable, FK to employees) — links expense to employee
*/

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_employee ON expenses(employee_id);
