/*
# Grant table-level privileges to anon role for Customer Portal

1. Purpose
- The Customer Portal uses the `anon` role with custom `x-client-token` header.
- RLS policies on `clients` and `client_sessions` tables exist for the `anon` role 
  (e.g., `anon_select_own_client`, `anon_update_own_client`), but the underlying 
  table-level GRANT statements were never executed.
- Without GRANT SELECT/INSERT/UPDATE on these tables, the `anon` role gets 
  "permission denied for table clients" even though RLS policies exist.
- The visit query embeds `client:clients!inner(*)` which requires SELECT on `clients`.

2. Root Cause
- Missing table-level GRANTs on `clients` for the `anon` role.
- RLS policies were created but the base table privileges were never granted.
- This is why the Profile page appeared to work (it used cached session data) 
  but the Visits page (which embeds `client:clients!inner(*)`) failed.

3. Fix
- GRANT SELECT on `clients` to `anon` (scoped by RLS to own row only).
- GRANT UPDATE on `clients` to `anon` (scoped by RLS to own row only).
- GRANT SELECT, INSERT, UPDATE, DELETE on `client_sessions` to `anon` 
  (needed for session management via Edge Function).

4. Security
- RLS remains enabled on both tables.
- RLS policies restrict access to the authenticated customer's own row only.
- `anon_select_own_client`: `USING (id = get_client_id_from_token())` — only own row.
- `anon_update_own_client`: `USING (id = get_client_id_from_token())` — only own row.
- No broad USING(true) policies.
- Customer A still cannot see Customer B's data.

5. No QR core changes
*/

GRANT SELECT ON public.clients TO anon;
GRANT UPDATE ON public.clients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_sessions TO anon;
