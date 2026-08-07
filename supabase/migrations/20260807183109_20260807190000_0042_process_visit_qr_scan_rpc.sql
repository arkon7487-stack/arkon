-- Narrow server-authoritative QR visit status transition for field workers.
-- Workers cannot use direct UPDATE on visits (admin-only policy stays).
-- This function validates ownership + status + QR binding in one atomic call.

CREATE OR REPLACE FUNCTION public.process_visit_qr_scan(
  p_visit_id uuid,
  p_qr_code text,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id uuid;
  v_visit RECORD;
  v_qr RECORD;
  v_new_status text;
  v_now timestamptz := now();
BEGIN
  -- 1. Derive worker from auth session (never from a parameter)
  v_employee_id := public.current_user_employee_id();
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: No employee linked to this account';
  END IF;

  -- 2. Fetch the visit (RLS-safe: SECURITY DEFINER bypasses, so we check ownership manually)
  SELECT id, status, employee_id, contract_id
  INTO v_visit
  FROM public.visits
  WHERE id = p_visit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Visit does not exist';
  END IF;

  -- 3. Ownership: only the assigned worker can transition this visit
  IF v_visit.employee_id IS NULL OR v_visit.employee_id <> v_employee_id THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: This visit is not assigned to you';
  END IF;

  -- 4. QR validation: the scanned code must exist and bind to the same contract or client
  SELECT qr.client_id, qr.visit_id, qr.contract_id
  INTO v_qr
  FROM public.qr_codes qr
  WHERE qr.code_value = p_qr_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_QR: QR code not found';
  END IF;

  -- 5. QR binding check: visit-scoped, contract-scoped, or client-scoped
  DECLARE
    v_visit_client_id uuid;
    v_bound boolean := false;
  BEGIN
    SELECT c.client_id INTO v_visit_client_id
    FROM public.contracts c WHERE c.id = v_visit.contract_id;

    -- visit-scoped QR
    IF v_qr.visit_id IS NOT NULL AND v_qr.visit_id = v_visit.id THEN
      v_bound := true;
    -- contract-scoped QR
    ELSIF v_qr.contract_id IS NOT NULL AND v_qr.contract_id = v_visit.contract_id THEN
      v_bound := true;
    -- client-scoped QR
    ELSIF v_qr.client_id IS NOT NULL AND v_qr.client_id = v_visit_client_id THEN
      v_bound := true;
    END IF;

    IF NOT v_bound THEN
      RAISE EXCEPTION 'WRONG_QR: This QR code does not belong to this visit';
    END IF;
  END;

  -- 6. Status transition validation: only scheduled->started or started->completed
  IF v_visit.status = 'scheduled' THEN
    v_new_status := 'started';
  ELSIF v_visit.status = 'started' THEN
    v_new_status := 'completed';
  ELSE
    RAISE EXCEPTION 'INVALID_STATE: Visit is % — no QR transition available', v_visit.status;
  END IF;

  -- 7. Perform the update
  IF v_new_status = 'started' THEN
    UPDATE public.visits
    SET status = 'started',
        started_at = v_now,
        start_gps_lat = p_lat,
        start_gps_lng = p_lng,
        updated_at = v_now
    WHERE id = p_visit_id;
  ELSE
    UPDATE public.visits
    SET status = 'completed',
        finished_at = v_now,
        completed_at = v_now,
        end_gps_lat = p_lat,
        end_gps_lng = p_lng,
        updated_at = v_now
    WHERE id = p_visit_id;
  END IF;

  -- 8. Return the authoritative updated row
  RETURN jsonb_build_object(
    'success', true,
    'visit_id', p_visit_id,
    'old_status', v_visit.status,
    'new_status', v_new_status
  );
END;
$$;

-- Revoke public access, grant to authenticated workers only
REVOKE EXECUTE ON FUNCTION public.process_visit_qr_scan FROM anon, public;
GRANT EXECUTE ON FUNCTION public.process_visit_qr_scan TO authenticated;
