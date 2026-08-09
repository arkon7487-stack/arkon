-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731214508_0019_lock_rbac_tables

/*
  # Stop self-service privilege escalation (F9, F10)

  `profiles` had `UPDATE ... USING (true) WITH CHECK (true)` for every
  authenticated user with all columns updatable, so any employee could set their
  own `role_id` to Super Admin. Separately, `role_permissions` accepted INSERT
  and DELETE, and `roles` / `permissions` accepted INSERT/UPDATE, from any
  authenticated user - a second route to the same escalation. All three RBAC
  tables were also readable by `anon`, publishing the permission model.

  1. Changes
     - `profiles`: SELECT limited to the caller's own row (or Super Admin).
       No client INSERT or UPDATE at all - profiles are created by the service
       role inside the employee-create edge function.
     - `roles`, `permissions`, `role_permissions`: read-only for `authenticated`
;

       all client write policies removed
;
 `anon` revoked.

  2. Security
     - Role and permission assignment can now only happen through the service
       role, which the browser never holds.
     - Sign-in still resolves the caller's own profile, role and permissions,
       because the helper functions are SECURITY DEFINER and the own-row SELECT
       policy is preserved.
*/

-- profiles
DO $$
DECLARE pol record
;

BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
  LOOP EXECUTE format('DROP POLICY %I ON public.profiles', pol.policyname)
;
 END LOOP
;

END $$
;


CREATE POLICY "select_own_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin())
;


REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM authenticated
;

REVOKE ALL ON TABLE public.profiles FROM anon
;


-- roles / permissions / role_permissions
DO $$
DECLARE pol record
;

BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies
             WHERE schemaname='public' AND tablename IN ('roles','permissions','role_permissions')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename)
;
 END LOOP
;

END $$
;


CREATE POLICY "select_roles" ON public.roles
  FOR SELECT TO authenticated USING (true)
;

CREATE POLICY "select_permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true)
;

CREATE POLICY "select_role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true)
;


REVOKE INSERT, UPDATE, DELETE ON TABLE public.roles FROM authenticated
;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.permissions FROM authenticated
;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.role_permissions FROM authenticated
;

REVOKE ALL ON TABLE public.roles FROM anon
;

REVOKE ALL ON TABLE public.permissions FROM anon
;

REVOKE ALL ON TABLE public.role_permissions FROM anon
;

