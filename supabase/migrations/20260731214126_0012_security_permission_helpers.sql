-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731214126_0012_security_permission_helpers

/*
  # Server-side permission helpers

  Adds SECURITY DEFINER helpers so RLS policies can enforce the application's
  own RBAC model (roles / permissions / role_permissions) instead of relying on
  client-side checks in React.

  1. New functions
     - `public.is_super_admin()` - true when the calling user's profile role is super_admin
     - `public.has_app_permission(p_key text)` - true when the calling user's role
       holds the named permission, or is super_admin

  2. Security
     - Both are STABLE SECURITY DEFINER with a fixed search_path, so they can read
       profiles/roles/role_permissions regardless of the caller's own policies
       without being hijackable through search_path.
     - EXECUTE granted to `authenticated` only
;
 `anon` is explicitly revoked.
*/

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.user_id = auth.uid()
      AND r.key = 'super_admin'
  )
;

$$
;


CREATE OR REPLACE FUNCTION public.has_app_permission(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.user_id = auth.uid()
      AND (
        r.key = 'super_admin'
        OR EXISTS (
          SELECT 1
          FROM public.role_permissions rp
          JOIN public.permissions pe ON pe.id = rp.permission_id
          WHERE rp.role_id = r.id
            AND pe.key = p_key
        )
      )
  )
;

$$
;


REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC
;

REVOKE ALL ON FUNCTION public.has_app_permission(text) FROM PUBLIC
;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated
;

GRANT EXECUTE ON FUNCTION public.has_app_permission(text) TO authenticated
;

