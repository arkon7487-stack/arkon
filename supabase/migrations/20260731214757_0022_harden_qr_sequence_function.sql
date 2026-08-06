-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731214757_0022_harden_qr_sequence_function

/*
  # Harden the QR numbering function (F22)

  `public.get_next_qr_sequence()` is SECURITY DEFINER with no fixed search_path
  and EXECUTE granted to `anon`, so any unauthenticated caller could POST to
  /rest/v1/rpc/get_next_qr_sequence and burn the sequence, and a shadowing
  object in an earlier schema would have run with the owner's rights.

  1. Changes
     - Pin `search_path` to `public, pg_temp`
     - Revoke EXECUTE from PUBLIC and `anon`, keep it for `authenticated`

  2. Security
     - QR generation happens on the staff client profile page, which runs as an
       authenticated user, so behaviour there is unchanged.
*/

ALTER FUNCTION public.get_next_qr_sequence() SET search_path = public, pg_temp
;


REVOKE ALL ON FUNCTION public.get_next_qr_sequence() FROM PUBLIC
;

REVOKE ALL ON FUNCTION public.get_next_qr_sequence() FROM anon
;

GRANT EXECUTE ON FUNCTION public.get_next_qr_sequence() TO authenticated
;

