-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731214727_0021_gate_employee_and_settings_writes

/*
  # Gate employee, settings and company writes on permissions (F23)

  `employees`, `settings` and `companies` all had always-true policies for every
  authenticated user, so a field employee could read every colleague's salary and
  national id, raise their own `monthly_salary`, or rewrite company-wide
  configuration - even though the product defines `employees` and `settings`
  permissions and gates the matching screens on them in the UI only.

  1. Changes
     - `employees`: reads stay open to all staff (the schedule, visit and payroll
       screens join employee names)
;
 INSERT/UPDATE/DELETE now require the
       `employees` permission.
     - `settings` and `companies`: writes require the `settings` permission.

  2. Security
     - Row-level gating is sufficient here: an employee without the `employees`
       permission cannot update ANY employee row, including their own, so the
       salary columns are no longer self-writable.
     - HR, Supervisor, Administrator and Super Admin hold `employees`, and
       Administrator and Super Admin hold `settings`, so the existing screens
       keep working for the roles that own them.
*/

-- employees
DROP POLICY IF EXISTS "insert_employees" ON public.employees
;

DROP POLICY IF EXISTS "update_employees" ON public.employees
;

DROP POLICY IF EXISTS "delete_employees" ON public.employees
;


CREATE POLICY "insert_employees" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('employees'))
;

CREATE POLICY "update_employees" ON public.employees
  FOR UPDATE TO authenticated
  USING (public.has_app_permission('employees'))
  WITH CHECK (public.has_app_permission('employees'))
;

CREATE POLICY "delete_employees" ON public.employees
  FOR DELETE TO authenticated USING (public.has_app_permission('employees'))
;


-- settings
DROP POLICY IF EXISTS "insert_settings" ON public.settings
;

DROP POLICY IF EXISTS "update_settings" ON public.settings
;


CREATE POLICY "insert_settings" ON public.settings
  FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('settings'))
;

CREATE POLICY "update_settings" ON public.settings
  FOR UPDATE TO authenticated
  USING (public.has_app_permission('settings'))
  WITH CHECK (public.has_app_permission('settings'))
;


-- companies
DROP POLICY IF EXISTS "insert_companies" ON public.companies
;

DROP POLICY IF EXISTS "update_companies" ON public.companies
;


CREATE POLICY "insert_companies" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('settings'))
;

CREATE POLICY "update_companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.has_app_permission('settings'))
  WITH CHECK (public.has_app_permission('settings'))
;

