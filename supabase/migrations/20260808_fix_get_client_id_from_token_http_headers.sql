/*
# Fix get_client_id_from_token() to read REAL PostgREST HTTP headers

## Root Cause

The function previously read `current_setting('request.x_client_token', true)`,
expecting PostgREST to map the `x-client-token` HTTP header to a GUC named
`request.x_client_token`.  PostgREST does NOT create per-header GUCs.
It exposes all request headers as a single JSON object in
`current_setting('request.headers', true)`.

The previous `SET LOCAL request.x_client_token = '...'` test manually created
a GUC that real HTTP requests never produce, causing a false positive.

## Fix

`CREATE OR REPLACE FUNCTION public.get_client_id_from_token()` now:
1. Reads `current_setting('request.headers', true)` and casts to jsonb.
2. Extracts `x-client-token` (lower-case, matching PostgREST convention).
3. Falls back to the legacy `request.x_client_token` GUC ONLY for internal tests.
4. Validates the token against `client_sessions` (expiry + revoked check).

## Functions affected

- `get_client_id_from_token()` — the authoritative token extractor (FIXED)
- `get_my_client_id()` — delegates to the above (auto-fixed)
- `create_my_service_request()` — delegates to the above (auto-fixed)

## Security

- SECURITY DEFINER preserved.
- search_path = 'public' preserved.
- No token value is returned or logged.
- Session expiry and revocation checks preserved.
- PUBLIC execute revoked; granted to `anon` and `authenticated` only.
*/
CREATE OR REPLACE FUNCTION public.get_client_id_from_token()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_headers jsonb;
  v_token text;
  v_client_id uuid;
BEGIN
  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION
    WHEN OTHERS THEN
      v_headers := '{}'::jsonb;
  END;

  v_token := nullif(v_headers ->> 'x-client-token', '');

  IF v_token IS NULL OR v_token = '' THEN
    v_token := nullif(current_setting('request.x_client_token', true), '');
  END IF;

  IF v_token IS NULL OR v_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT cs.client_id
  INTO v_client_id
  FROM client_sessions cs
  WHERE cs.token = v_token
    AND cs.revoked = false
    AND cs.expires_at > now();

  RETURN v_client_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_client_id_from_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_id_from_token() TO anon, authenticated;
