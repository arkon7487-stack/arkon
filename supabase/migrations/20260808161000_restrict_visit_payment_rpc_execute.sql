/*
# Restrict additional-visit payment RPC execution

1. Purpose
- Remove anonymous and PUBLIC EXECUTE grants from `record_visit_invoice_payment`.
- Preserve the existing authenticated Finance permission check inside the function.

2. Modified database object
- `public.record_visit_invoice_payment(uuid, numeric, text, date, text)`

3. Security
- `PUBLIC` and `anon` can no longer invoke the payment RPC.
- `authenticated` retains EXECUTE so Finance users can use the existing flow.
- No table data, payment logic, invoice logic, or RLS policy is changed.

4. Safety
- This is a privilege-only correction and does not alter existing records.
*/

REVOKE EXECUTE ON FUNCTION public.record_visit_invoice_payment(uuid, numeric, text, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_visit_invoice_payment(uuid, numeric, text, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_visit_invoice_payment(uuid, numeric, text, date, text) TO authenticated;
