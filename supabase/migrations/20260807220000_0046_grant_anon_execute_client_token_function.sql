/*
# Grant EXECUTE on get_client_id_from_token() to anon role

1. Purpose
- The Customer Portal uses a custom Phone+PIN authentication system, NOT Supabase Auth.
- The browser sends requests as the `anon` role with an `x-client-token` header.
- RLS policies on visits, contracts, clients, service_requests, invoices, payments, 
  notifications, packages, qr_codes, visit_ratings, and employees all call 
  `get_client_id_from_token()` to resolve the authenticated customer.
- However, `get_client_id_from_token()` only had EXECUTE grants for `authenticated`, 
  `postgres`, and `service_role` — NOT `anon`.
- This caused EVERY customer portal database query to fail with 
  "permission denied for function get_client_id_from_token", which was silently 
  swallowed by the frontend catch blocks, leaving pages stuck on "جاري التحميل..." 
  (loading spinner) forever.

2. Root Cause
- Missing EXECUTE grant on `get_client_id_from_token()` for the `anon` role.
- The Customer Profile page appeared to work because it rendered from session 
  state cached at login time, not from a fresh database query.
- The Visits page and Support page performed fresh database queries that hit RLS, 
  which called `get_client_id_from_token()`, which failed with permission denied.

3. Fix
- Grant EXECUTE on `get_client_id_from_token()` to the `anon` role.
- This is safe because the function is SECURITY DEFINER (runs as the owner), 
  reads the token from the request GUC, validates against client_sessions 
  (revoked=false, expires_at > now()), and returns only the client_id.
- The anon role cannot bypass or manipulate the function — it can only call it, 
  and it returns NULL if no valid token exists.

4. Security
- No broad USING(true) policies added.
- No RLS policies changed.
- No existing permissions revoked.
- The function remains SECURITY DEFINER with search_path = public.
- Customer A still cannot see Customer B's data — the function only returns 
  the client_id matching the valid session token in the request header.

5. No QR core changes
- process_visit_qr_scan, QrScannerView, WorkerApp QR handler, same-day guard — 
  all untouched.
*/

GRANT EXECUTE ON FUNCTION public.get_client_id_from_token() TO anon;
