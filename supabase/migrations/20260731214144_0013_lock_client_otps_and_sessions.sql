-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731214144_0013_lock_client_otps_and_sessions

/*
  # Lock down client portal login codes and sessions (F4, F5)

  `client_otps` and `client_sessions` were reachable by the `anon` and
  `authenticated` roles for SELECT/INSERT/UPDATE/DELETE with always-true
  predicates. That published every login code hash and let anyone insert a
  session row for any client, which is a complete portal account takeover.

  These tables must only ever be touched by the service role inside the
  `arkon-client-auth` edge function (the service role bypasses RLS), and by the
  SECURITY DEFINER session resolver added in a later migration.

  1. Changes
     - Drop every anon/authenticated policy on both tables
     - Revoke all table privileges from anon and authenticated
     - Add an `attempts` counter to `client_otps` so the edge function can cap
       brute-force verification (F16)

  2. Security
     - RLS stays enabled
;
 with no policies and no grants the tables are
       unreachable through the Data API.
*/

DROP POLICY IF EXISTS "read_client_otps" ON public.client_otps
;

DROP POLICY IF EXISTS "insert_client_otps" ON public.client_otps
;

DROP POLICY IF EXISTS "update_client_otps" ON public.client_otps
;

DROP POLICY IF EXISTS "delete_client_otps" ON public.client_otps
;


DROP POLICY IF EXISTS "read_client_sessions" ON public.client_sessions
;

DROP POLICY IF EXISTS "insert_client_sessions" ON public.client_sessions
;

DROP POLICY IF EXISTS "update_client_sessions" ON public.client_sessions
;

DROP POLICY IF EXISTS "delete_client_sessions" ON public.client_sessions
;


DO $$
DECLARE
  pol record
;

BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('client_otps', 'client_sessions')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename)
;

  END LOOP
;

END $$
;


REVOKE ALL ON TABLE public.client_otps FROM anon, authenticated
;

REVOKE ALL ON TABLE public.client_sessions FROM anon, authenticated
;


ALTER TABLE public.client_otps ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0
;

