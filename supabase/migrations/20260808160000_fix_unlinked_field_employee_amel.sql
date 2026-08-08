/* Repair the unlinked field-worker identity for amel@gmail.com. */
DO $$
DECLARE
  v_employee_id uuid;
  v_profile_id uuid := 'e77123de-7b45-422e-aa41-4e649eaae54f';
  v_user_id uuid := '51aa6bfb-aba1-4fe2-a7a5-18e7fa263ac6';
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  SELECT employee_id INTO v_employee_id
  FROM profiles
  WHERE id = v_profile_id AND user_id = v_user_id;

  IF v_employee_id IS NULL THEN
    INSERT INTO employees (
      company_id,
      full_name,
      phone_number,
      employment_status,
      employment_date,
      auth_email
    )
    VALUES (
      '11111111-1111-1111-1111-111111111111',
      COALESCE(v_email, 'Field Worker'),
      '000',
      'active',
      CURRENT_DATE,
      v_email
    )
    RETURNING id INTO v_employee_id;

    UPDATE profiles
    SET employee_id = v_employee_id
    WHERE id = v_profile_id AND user_id = v_user_id;
  END IF;
END $$;
