/*
# Fix unlinked field_employee profile (amel@gmail.com)

Profile user_id 51aa6bfb-... has role field_employee but employee_id IS NULL.
This breaks the Worker Portal identity chain.

Fix: create an employee record and link the profile.
*/

DO $$
DECLARE
  v_employee_id uuid;
  v_profile_id uuid := 'e77123de-7b45-422e-aa41-4e649eaae54f';
  v_user_id uuid := '51aa6bfb-aba1-4fe2-a7a5-18e7fa263ac6';
  v_full_name text;
BEGIN
  SELECT email INTO v_full_name FROM auth.users WHERE id = v_user_id;

  INSERT INTO employees (company_id, full_name, phone_number, employment_status, employment_date, auth_email)
  VALUES ('11111111-1111-1111-1111-111111111111', v_full_name, '000', 'active', CURRENT_DATE, v_full_name)
  RETURNING id INTO v_employee_id;

  UPDATE profiles SET employee_id = v_employee_id WHERE id = v_profile_id;
END $$;
