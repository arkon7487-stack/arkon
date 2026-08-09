-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731214232_0014_client_portal_token_access

/*
  # Token-scoped client portal access (F5, F6)

  The client portal previously ran entirely on the public anon key against
  always-true policies: `clients` was readable by `anon`, and the portal
  "session" was just a phone number in localStorage. Closing those holes would
  break the portal, so this migration gives the portal a real server-enforced
  read path instead.

  1. New functions
     - `public.client_portal_bootstrap(p_token text)` - validates an opaque
       session token issued by the `arkon-client-auth` edge function against
       `client_sessions`, and returns ONLY that client's own record, visits,
       invoices and active package as jsonb.

  2. Security
     - SECURITY DEFINER with a fixed search_path, so it can read the locked-down
       `client_sessions` table without exposing it.
     - Every returned row is scoped by the `client_id` stored on the session row,
       so a caller cannot reach another customer's data by changing a parameter -
       the only input is the bearer token itself.
     - Expired or unknown tokens return NULL.
     - EXECUTE granted to `anon` (the portal is not a Supabase auth user) and
       `authenticated`.
*/

CREATE OR REPLACE FUNCTION public.client_portal_bootstrap(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id uuid
;

  v_result jsonb
;

BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL
;

  END IF
;


  SELECT cs.client_id INTO v_client_id
  FROM public.client_sessions cs
  WHERE cs.token = p_token
    AND cs.expires_at > now()
  LIMIT 1
;


  IF v_client_id IS NULL THEN
    RETURN NULL
;

  END IF
;


  SELECT jsonb_build_object(
    'client', (
      SELECT to_jsonb(c) FROM public.clients c WHERE c.id = v_client_id
    ),
    'visits', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(v)
        || jsonb_build_object(
             'employee', (SELECT to_jsonb(e) FROM public.employees e WHERE e.id = v.employee_id)
           )
        ORDER BY v.scheduled_date DESC
      )
      FROM public.visits v
      JOIN public.contracts ct ON ct.id = v.contract_id
      WHERE ct.client_id = v_client_id
    ), '[]'::jsonb),
    'invoices', COALESCE((
      SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC)
      FROM public.invoices i
      JOIN public.contracts ct ON ct.id = i.contract_id
      WHERE ct.client_id = v_client_id
    ), '[]'::jsonb),
    'active_package', (
      SELECT p.name
      FROM public.contracts ct
      JOIN public.packages p ON p.id = ct.package_id
      WHERE ct.client_id = v_client_id
        AND ct.status = 'active'
      ORDER BY ct.created_at DESC
      LIMIT 1
    )
  ) INTO v_result
;


  RETURN v_result
;

END $$
;


REVOKE ALL ON FUNCTION public.client_portal_bootstrap(text) FROM PUBLIC
;

GRANT EXECUTE ON FUNCTION public.client_portal_bootstrap(text) TO anon, authenticated
;

