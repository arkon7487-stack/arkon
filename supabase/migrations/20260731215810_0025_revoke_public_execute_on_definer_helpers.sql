-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731215810_0025_revoke_public_execute_on_definer_helpers

/*
  # Remove default PUBLIC execute on privileged helpers

  Postgres grants EXECUTE to PUBLIC by default, so `is_super_admin`,
  `has_app_permission` and `record_contract_payment` remained callable by the
  `anon` role even though the fix migrations granted them to `authenticated`.

  1. Changes
     - Revoke EXECUTE from PUBLIC and anon on the three helpers
     - Re-grant EXECUTE to authenticated only
*/

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC
;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM anon
;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated
;


REVOKE ALL ON FUNCTION public.has_app_permission(text) FROM PUBLIC
;

REVOKE ALL ON FUNCTION public.has_app_permission(text) FROM anon
;

GRANT EXECUTE ON FUNCTION public.has_app_permission(text) TO authenticated
;


REVOKE ALL ON FUNCTION public.record_contract_payment(uuid, numeric, text, date, text) FROM PUBLIC
;

REVOKE ALL ON FUNCTION public.record_contract_payment(uuid, numeric, text, date, text) FROM anon
;

GRANT EXECUTE ON FUNCTION public.record_contract_payment(uuid, numeric, text, date, text) TO authenticated
;


REVOKE ALL ON FUNCTION public.client_portal_bootstrap(text) FROM PUBLIC
;

GRANT EXECUTE ON FUNCTION public.client_portal_bootstrap(text) TO anon, authenticated
;

