/*
  # Capture who recorded each contract payment

  The `record_contract_payment` function was inserting into `contract_payments`
  without setting `recorded_by`, even though the table has the column. Now it
  captures the caller's user id from the authenticated session.

  1. Changes
     - `record_contract_payment` sets `recorded_by = auth.uid()::text` on insert.
  2. Security
     - No policy or grant changes; the function is already SECURITY DEFINER
       with EXECUTE granted to `authenticated` only.
*/

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
  v_final numeric;
  v_paid numeric;
  v_remaining numeric;
  v_company uuid;
  v_new_paid numeric;
  v_new_remaining numeric;
  v_status text;
  v_payment jsonb;
BEGIN
  IF NOT public.has_app_permission('finance') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT c.final_amount, COALESCE(c.amount_paid, 0), c.company_id
  INTO v_final, v_paid, v_company
  FROM public.contracts c
  WHERE c.id = p_contract_id
  FOR UPDATE;

  IF v_final IS NULL AND v_paid IS NULL THEN
    RAISE EXCEPTION 'contract_not_found';
  END IF;

  v_final := COALESCE(v_final, 0);
  v_remaining := GREATEST(v_final - v_paid, 0);

  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'amount_exceeds_remaining';
  END IF;

  v_new_paid := v_paid + p_amount;
  v_new_remaining := GREATEST(v_final - v_new_paid, 0);
  v_status := CASE
    WHEN v_new_remaining = 0 THEN 'fully_paid'
    WHEN v_new_paid > 0 THEN 'partially_paid'
    ELSE 'unpaid'
  END;

  INSERT INTO public.contract_payments (
    company_id, contract_id, amount, payment_method, payment_date, notes, recorded_by
  ) VALUES (
    v_company, p_contract_id, p_amount, p_payment_method,
    COALESCE(p_payment_date, CURRENT_DATE),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    auth.uid()::text
  )
  RETURNING to_jsonb(contract_payments.*) INTO v_payment;

  UPDATE public.contracts
  SET amount_paid = v_new_paid,
      remaining_balance = v_new_remaining,
      payment_status = v_status,
      updated_at = now()
  WHERE id = p_contract_id;

  RETURN v_payment;
END $$;

REVOKE ALL ON FUNCTION public.record_contract_payment(uuid, numeric, text, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_contract_payment(uuid, numeric, text, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_contract_payment(uuid, numeric, text, date, text) TO authenticated;
