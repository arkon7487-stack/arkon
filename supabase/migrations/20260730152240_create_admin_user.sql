/*
# Create Super Admin user

1. Purpose
   - Creates the initial Super Admin auth user so the platform can be accessed.
   - Links the auth user to the existing `super_admin` role via the `profiles` table.

2. Changes
   - Inserts a row into `auth.users` with email `admin@arkon.enterprise` and a bcrypt-hashed password.
   - Inserts a row into `public.profiles` linking the new auth user to the `super_admin` role.

3. Security
   - Email confirmation is set to now() so the user can sign in immediately.
   - The password is hashed using crypt() with bf (blowfish) to match Supabase's auth expectations.

4. Notes
   - This is a one-time bootstrap migration.
   - Credentials: email `admin@arkon.enterprise`, password `Arkon@2026`.
*/

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_role_id uuid;
BEGIN
  -- Fetch the super_admin role id
  SELECT id INTO v_role_id FROM roles WHERE name = 'Super Admin';
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Super Admin role not found';
  END IF;

  -- Insert auth user only if it doesn't already exist
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@arkon.enterprise') THEN
    INSERT INTO auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    ) VALUES (
      v_user_id,
      'authenticated',
      'authenticated',
      'admin@arkon.enterprise',
      crypt('Arkon@2026', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb
    );

    -- Link to profile with super_admin role
    INSERT INTO profiles (user_id, role_id, employee_id)
    VALUES (v_user_id, v_role_id, NULL)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;
