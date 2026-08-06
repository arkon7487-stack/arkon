-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260806145227_0036b_revoke_public_execute.sql

/*
# RLS Hardening — Stage 2b: Revoke PUBLIC execute on internal functions
#
# PostgreSQL grants EXECUTE on functions to PUBLIC by default.
# The previous REVOKE from anon/authenticated was not sufficient.
*/

-- Revoke from PUBLIC (covers anon, authenticated, and any other role)
REVOKE EXECUTE ON FUNCTION public.notify_visit_status_change() FROM PUBLIC
;

REVOKE EXECUTE ON FUNCTION public.notify_visit_modified() FROM PUBLIC
;

REVOKE EXECUTE ON FUNCTION public.current_user_employee_id() FROM PUBLIC
;

REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM PUBLIC
;

REVOKE EXECUTE ON FUNCTION public.get_client_id_from_token() FROM PUBLIC
;

REVOKE EXECUTE ON FUNCTION public.get_next_qr_sequence() FROM PUBLIC
;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC
;

REVOKE EXECUTE ON FUNCTION public.has_app_permission(text) FROM PUBLIC
;

REVOKE EXECUTE ON FUNCTION public.record_contract_payment(uuid, numeric, text, date, text) FROM PUBLIC
;


-- Grant EXECUTE only to authenticated (these are needed by the app)
-- Trigger functions don't need explicit grants — they run via trigger, not RPC
GRANT EXECUTE ON FUNCTION public.current_user_employee_id() TO authenticated
;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated
;

GRANT EXECUTE ON FUNCTION public.get_client_id_from_token() TO authenticated
;

GRANT EXECUTE ON FUNCTION public.has_app_permission(text) TO authenticated
;


-- client_portal_bootstrap and client_portal_update_profile stay callable by anon
-- (customer portal uses token auth, not Supabase Auth)
GRANT EXECUTE ON FUNCTION public.client_portal_bootstrap(text) TO anon, authenticated
;

GRANT EXECUTE ON FUNCTION public.client_portal_update_profile(text, text, text, text) TO anon, authenticated
;

