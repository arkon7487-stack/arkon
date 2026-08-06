-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731215305_0023_client_portal_profile_and_minimal_employee

/*
  # Client portal: minimal employee data + token-scoped profile update (F6)

  1. Changes
     - `client_portal_bootstrap` now returns only the assigned employee's name
       and phone instead of the whole employee row (which carries salary and
       identity fields).
     - New `client_portal_update_profile(p_token, p_phone, p_email, p_address)`
       lets a customer holding a valid portal token update only their own
       contact fields, replacing the anonymous table write the portal used.

  2. Security
     - Both functions are SECURITY DEFINER with a pinned search_path and are
       keyed on an unguessable session token, not on a client id supplied by
       the caller.
*/

CREATE OR REPLACE FUNCTION public.client_portal_bootstrap(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
    'client', (SELECT to_jsonb(c) FROM public.clients c WHERE c.id = v_client_id),
    'visits', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(v) || jsonb_build_object(
          'employee', (
            SELECT jsonb_build_object('id', e.id, 'full_name', e.full_name, 'phone_number', e.phone_number)
            FROM public.employees e WHERE e.id = v.employee_id
          )
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
      WHERE ct.client_id = v_client_id AND ct.status = 'active'
      ORDER BY ct.created_at DESC
      LIMIT 1
    )
  ) INTO v_result
;


  RETURN v_result
;

END $$
;


CREATE OR REPLACE FUNCTION public.client_portal_update_profile(
  p_token text,
  p_phone text,
  p_email text,
  p_address text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id uuid
;

  v_row public.clients
;

BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RAISE EXCEPTION 'not_authorized'
;

  END IF
;


  SELECT cs.client_id INTO v_client_id
  FROM public.client_sessions cs
  WHERE cs.token = p_token AND cs.expires_at > now()
  LIMIT 1
;


  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized'
;

  END IF
;


  IF p_phone IS NULL OR btrim(p_phone) = '' THEN
    RAISE EXCEPTION 'invalid_phone'
;

  END IF
;


  UPDATE public.clients
  SET phone_number = btrim(p_phone),
      email = NULLIF(btrim(COALESCE(p_email, '')), ''),
      address = NULLIF(btrim(COALESCE(p_address, '')), ''),
      updated_at = now()
  WHERE id = v_client_id
  RETURNING * INTO v_row
;


  RETURN to_jsonb(v_row)
;

END $$
;


REVOKE ALL ON FUNCTION public.client_portal_update_profile(text, text, text, text) FROM PUBLIC
;

GRANT EXECUTE ON FUNCTION public.client_portal_update_profile(text, text, text, text) TO anon, authenticated
;

