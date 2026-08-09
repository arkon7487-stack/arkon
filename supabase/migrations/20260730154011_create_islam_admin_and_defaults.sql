/*
# Create Default Admin User & Palestine Locale Settings

1. Auth User
   - Creates `islam@gmail.com` with password `ARKON@2026` using bcrypt hashing
   - If user already exists, updates the password instead
   - Links the user to the Super Admin role via the profiles table

2. Default Settings
   - Sets company address to Nablus, Palestine
   - Sets default phone prefix to +972
   - Sets default currency to ILS (₪)
   - Sets default timezone to Asia/Hebron
   - Sets default language to Arabic (ar)

3. Notes
   - Uses pgcrypto crypt() with blowfish to match GoTrue's bcrypt format
   - Idempotent: safe to re-run
*/

DO $$
DECLARE
  v_user_id uuid;
  v_role_id uuid;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'Super Admin';
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Super Admin role not found — ensure core schema migration ran first';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = 'islam@gmail.com';

  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET encrypted_password    = crypt('ARKON@2026', gen_salt('bf')),
        email_confirmed_at    = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data     = '{"provider":"email","providers":["email"]}'::jsonb,
        updated_at            = now()
    WHERE id = v_user_id;
  ELSE
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      v_user_id, 'authenticated', 'authenticated',
      'islam@gmail.com',
      crypt('ARKON@2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Islam Admin"}'::jsonb
    );
  END IF;

  INSERT INTO profiles (user_id, role_id, employee_id, display_name)
  VALUES (v_user_id, v_role_id, NULL, 'Islam Admin')
  ON CONFLICT (user_id) DO UPDATE SET role_id = EXCLUDED.role_id, display_name = EXCLUDED.display_name;
END $$;

-- ===== DEFAULT PALESTINE LOCALE SETTINGS =====
INSERT INTO settings (key, value, updated_at) VALUES
  ('country',           '"Palestine"',      now()),
  ('city',              '"Nablus"',         now()),
  ('phone_prefix',      '"+972"',           now()),
  ('currency',          '"ILS"',            now()),
  ('timezone',          '"Asia/Hebron"',    now()),
  ('language',          '"ar"',             now()),
  ('address',           '"نابلس، فلسطين"', now()),
  ('company_name',      '"ARKON"',          now()),
  ('legal_name',        '"ARKON Enterprise"', now()),
  ('email',             '"info@arkon.ps"',  now()),
  ('phone',             '"+972-9-000-0000"',now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
