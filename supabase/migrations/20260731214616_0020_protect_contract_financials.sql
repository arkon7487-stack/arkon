-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731214616_0020_protect_contract_financials

/*
  # Protect contract payment totals and make payment recording atomic (F17, F18)

  `contracts` had `UPDATE ... USING (true) WITH CHECK (true)` with every column
  updatable, so any signed-in employee could PATCH
  `{amount_paid, remaining_balance, payment_status}` directly and mark a contract
  fully paid without any payment existing. Separately, the client-side payment
  flow read the contract, computed the new totals and wrote them back in
  separate round trips, so two concurrent payments could overwrite each other,
  and the only overpayment check lived in the browser.

  1. Changes
     - Column-level UPDATE: `authenticated` keeps UPDATE on every contract column
       EXCEPT `amount_paid`, `remaining_balance` and `payment_status`.
     - New `public.record_contract_payment(...)` SECURITY DEFINER function that
       locks the contract row, re-validates the amount server-side, inserts the
       payment and recomputes the totals in one transaction.

  2. Security
     - The value-bearing columns can now only change through the function.
     - The function requires the `finance` permission, rejects non-positive
       amounts, and rejects any amount above the remaining balance, so the
       browser's arithmetic is no longer trusted.
     - `SELECT ... FOR UPDATE` serialises concurrent payments on the same
       contract, closing the lost-update race.
*/

REVOKE UPDATE ON TABLE public.contracts FROM authenticated
;

GRANT UPDATE (
  id, company_id, contract_number, client_id, package_id, employee_id,
  start_date, end_date, contract_duration_weeks, status, price, discount, tax,
  final_amount, signed_contract_url, notes, activated_at, created_at,
  updated_at, contract_type
) ON TABLE public.contracts TO authenticated
;


CREATE OR REPLACE FUNCTION public.record_contract_payment(
  p_contract_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT NULL,
  p_payment_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_final numeric
;

  v_paid numeric
;

  v_remaining numeric
;

  v_company uuid
;

  v_new_paid numeric
;

  v_new_remaining numeric
;

  v_status text
;

  v_payment jsonb
;

BEGIN
  IF NOT public.has_app_permission('finance') THEN
    RAISE EXCEPTION 'not_authorized'
;

  END IF
;


  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount'
;

  END IF
;


  SELECT c.final_amount, COALESCE(c.amount_paid, 0), c.company_id
    INTO v_final, v_paid, v_company
  FROM public.contracts c
  WHERE c.id = p_contract_id
  FOR UPDATE
;


  IF v_final IS NULL AND v_paid IS NULL THEN
    RAISE EXCEPTION 'contract_not_found'
;

  END IF
;


  v_final := COALESCE(v_final, 0)
;

  v_remaining := GREATEST(v_final - v_paid, 0)
;


  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'amount_exceeds_remaining'
;

  END IF
;


  v_new_paid := v_paid + p_amount
;

  v_new_remaining := GREATEST(v_final - v_new_paid, 0)
;

  v_status := CASE
    WHEN v_new_remaining = 0 THEN 'fully_paid'
    WHEN v_new_paid > 0 THEN 'partially_paid'
    ELSE 'unpaid'
  END
;


  INSERT INTO public.contract_payments (
    company_id, contract_id, amount, payment_method, payment_date, notes
  ) VALUES (
    v_company, p_contract_id, p_amount, p_payment_method,
    COALESCE(p_payment_date, CURRENT_DATE), NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING to_jsonb(contract_payments.*) INTO v_payment
;


  UPDATE public.contracts
  SET amount_paid = v_new_paid,
      remaining_balance = v_new_remaining,
      payment_status = v_status,
      updated_at = now()
  WHERE id = p_contract_id
;


  RETURN v_payment
;

END $$
;


REVOKE ALL ON FUNCTION public.record_contract_payment(uuid, numeric, text, date, text) FROM PUBLIC
;

GRANT EXECUTE ON FUNCTION public.record_contract_payment(uuid, numeric, text, date, text) TO authenticated
;

