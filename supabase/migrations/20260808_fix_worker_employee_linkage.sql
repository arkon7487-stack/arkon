/*
# Fix Worker Portal Identity: Create missing employee records and link profiles

## Root Cause

9 field_employee profiles had employee_id = NULL because they were created
through direct Supabase Auth signup (older path) without creating a matching
employee record or linking the profile.employee_id.

Only the worker created through the arkon-employee-create edge function
(احمد خطاب) had the correct profile → employee linkage.

This caused the Worker Portal to show "لا يوجد ملف موظف" because:
1. profiles.employee_id was NULL
2. current_user_employee_id() returned NULL
3. employees RLS policy `id = current_user_employee_id()` blocked all rows
4. WorkerApp.tsx checked `session?.profile?.employee_id` and showed the error

## Fix

For each field_employee profile with NULL employee_id:
1. Create an employees row using their auth email and display name.
2. Update the profile.employee_id to point to the new employee record.

This restores the identity chain:
  auth.users.id → profiles.user_id → profiles.employee_id → employees.id

## Security

- No existing data is modified or deleted.
- Only NULL employee_id values are filled.
- Employee records use the same company_id as the existing employee.
- RLS policies remain unchanged.
- No USING(true), no service_role, no bypass.
*/
DO $$
DECLARE
  v_company_id uuid := '11111111-1111-1111-1111-111111111111';
  r RECORD;
  v_employee_id uuid;
BEGIN
  FOR r IN
    SELECT p.user_id, p.display_name, u.email
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    JOIN roles rl ON rl.id = p.role_id
    WHERE rl.key = 'field_employee'
      AND p.employee_id IS NULL
  LOOP
    -- Create employee record
    INSERT INTO employees (
      company_id, full_name, phone_number,
      employment_status, auth_email, username
    ) VALUES (
      v_company_id, r.display_name, '',
      'active', r.email, split_part(r.email, '@', 1)
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_employee_id;

    IF v_employee_id IS NOT NULL THEN
      -- Link the profile to the employee
      UPDATE profiles
      SET employee_id = v_employee_id
      WHERE user_id = r.user_id AND employee_id IS NULL;
    END IF;

    v_employee_id := NULL;
  END LOOP;
END $$;
