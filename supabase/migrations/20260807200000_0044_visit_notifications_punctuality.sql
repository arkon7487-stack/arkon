/*
# Visit status notifications — enrich with actual timestamps + punctuality

1. Purpose
- Preserve all existing notification behavior (admin start/completion, client start/completion, worker assign/cancel).
- Add authoritative actual timestamps (started_at, completed_at) and scheduled time to notification metadata.
- Add punctuality calculation (differenceMinutes + status) to admin start notifications.
- Wrap notification INSERTs in a defensive EXCEPTION block so notification failure can NEVER roll back the visit UPDATE.

2. Security
- Replaces the existing function in place with CREATE OR REPLACE FUNCTION.
- Preserves SECURITY DEFINER and SET search_path = public.
- Does NOT change trigger definitions, trigger names, or the visits table.
- Does NOT change RLS policies on notifications.

3. Punctuality
- Only calculated for scheduled -> started transitions (admin notification only).
- Uses Asia/Hebron timezone (matching the verified QR same-day guard).
- Compares scheduled_start_time (on scheduled_date) against started_at.
- differenceMinutes = actual - scheduled (positive = late, negative = early, 0 = on_time).
- No grace period invented.

4. Defensive exception handling
- The entire notification INSERT block is wrapped in BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE NOTICE.
- This ensures that if notification creation fails for any reason, the visit UPDATE (already committed by the caller) is NOT rolled back.
- The trigger returns NEW/OLD regardless of notification success.
*/

CREATE OR REPLACE FUNCTION public.notify_visit_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_client_name text;
  v_employee_name text;
  v_old_status text := COALESCE(OLD.status, '');
  v_new_status text := COALESCE(NEW.status, '');
  v_employee_id uuid := COALESCE(NEW.employee_id, OLD.employee_id);
  v_contract_id uuid := COALESCE(NEW.contract_id, OLD.contract_id);
  v_scheduled_date text := COALESCE(NEW.scheduled_date::text, '');
  v_scheduled_time text := COALESCE(NEW.scheduled_start_time::text, '');
  v_package_name text;
  v_metadata jsonb;
  v_started_at text := COALESCE(NEW.started_at::text, '');
  v_completed_at text := COALESCE(NEW.completed_at::text, '');
  v_finished_at text := COALESCE(NEW.finished_at::text, '');
  v_difference_minutes integer;
  v_punctuality_status text;
  v_scheduled_datetime timestamptz;
  v_tz text := 'Asia/Hebron';
BEGIN
  SELECT ct.client_id, c.full_name, p.name
  INTO v_client_id, v_client_name, v_package_name
  FROM contracts ct
  LEFT JOIN clients c ON c.id = ct.client_id
  LEFT JOIN packages p ON p.id = ct.package_id
  WHERE ct.id = v_contract_id;

  v_client_name := COALESCE(v_client_name, 'عميل');

  v_metadata := jsonb_build_object(
    'visit_id', COALESCE(NEW.id, OLD.id),
    'employee_id', v_employee_id,
    'contract_id', v_contract_id,
    'client_id', v_client_id,
    'client_name', v_client_name,
    'scheduled_date', v_scheduled_date,
    'scheduled_time', v_scheduled_time,
    'package_name', v_package_name,
    'old_status', v_old_status,
    'new_status', v_new_status,
    'started_at', v_started_at,
    'completed_at', v_completed_at,
    'finished_at', v_finished_at
  );

  BEGIN
    IF v_new_status = 'started' AND v_old_status <> 'started' THEN
      SELECT e.full_name INTO v_employee_name FROM employees e WHERE e.id = v_employee_id;
      v_employee_name := COALESCE(v_employee_name, 'العامل');

      IF NEW.scheduled_start_time IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        v_scheduled_datetime := (NEW.scheduled_date::text || ' ' || NEW.scheduled_start_time::text)::timestamptz AT TIME ZONE v_tz;
        v_difference_minutes := EXTRACT(EPOCH FROM (NEW.started_at - v_scheduled_datetime))::integer / 60;

        IF v_difference_minutes > 0 THEN
          v_punctuality_status := 'late';
        ELSIF v_difference_minutes < 0 THEN
          v_punctuality_status := 'early';
        ELSE
          v_punctuality_status := 'on_time';
        END IF;
      ELSE
        v_difference_minutes := NULL;
        v_punctuality_status := NULL;
      END IF;

      v_metadata := v_metadata || jsonb_build_object(
        'difference_minutes', v_difference_minutes,
        'punctuality_status', v_punctuality_status
      );

      INSERT INTO notifications (audience, category, notification_type, title, body, link, read, metadata)
      VALUES ('admin', 'visit', 'visit_started',
        'تم بدء الزيارة',
        'العميل: ' || v_client_name || E'\n' ||
        'العامل: ' || v_employee_name || E'\n' ||
        'وقت الزيارة المجدول: ' || v_scheduled_time || E'\n' ||
        'وقت مسح QR الفعلي: ' || to_char(NEW.started_at AT TIME ZONE v_tz, 'HH24:MI') ||
        CASE
          WHEN v_punctuality_status = 'late' THEN E'\nالحالة: متأخر ' || abs(v_difference_minutes) || ' دقيقة'
          WHEN v_punctuality_status = 'early' THEN E'\nالحالة: قبل الموعد بـ ' || abs(v_difference_minutes) || ' دقيقة'
          WHEN v_punctuality_status = 'on_time' THEN E'\nالحالة: في الموعد'
          ELSE ''
        END,
        '/visits', false, v_metadata);

      IF v_client_id IS NOT NULL THEN
        INSERT INTO notifications (client_id, audience, category, notification_type, title, body, link, read, metadata)
        VALUES (v_client_id, 'client', 'visit', 'visit_started', 'تم بدء زيارتك',
          'وقت الزيارة المجدول: ' || v_scheduled_time || E'\n' ||
          'وقت بدء الزيارة الفعلي: ' || to_char(NEW.started_at AT TIME ZONE v_tz, 'HH24:MI'),
          '/client/visits', false, v_metadata - 'difference_minutes' - 'punctuality_status');
      END IF;

    ELSIF v_new_status = 'completed' AND v_old_status <> 'completed' THEN
      SELECT e.full_name INTO v_employee_name FROM employees e WHERE e.id = v_employee_id;
      v_employee_name := COALESCE(v_employee_name, 'العامل');

      INSERT INTO notifications (audience, category, notification_type, title, body, link, read, metadata)
      VALUES ('admin', 'visit', 'visit_completed',
        'تم إنهاء الزيارة',
        'العميل: ' || v_client_name || E'\n' ||
        'العامل: ' || v_employee_name || E'\n' ||
        'وقت بدء الزيارة الفعلي: ' || COALESCE(to_char(NEW.started_at AT TIME ZONE v_tz, 'HH24:MI'), '—') || E'\n' ||
        'وقت إنهاء الزيارة الفعلي: ' || COALESCE(to_char(NEW.finished_at AT TIME ZONE v_tz, 'HH24:MI'), '—'),
        '/visits', false, v_metadata);

      IF v_client_id IS NOT NULL THEN
        INSERT INTO notifications (client_id, audience, category, notification_type, title, body, link, read, metadata)
        VALUES (v_client_id, 'client', 'visit', 'visit_completed', 'تم الانتهاء من زيارتك',
          'وقت بدء الزيارة الفعلي: ' || COALESCE(to_char(NEW.started_at AT TIME ZONE v_tz, 'HH24:MI'), '—') || E'\n' ||
          'وقت إنهاء الزيارة الفعلي: ' || COALESCE(to_char(NEW.finished_at AT TIME ZONE v_tz, 'HH24:MI'), '—'),
          '/client/visits', false, v_metadata);
      END IF;

    ELSIF v_new_status = 'cancelled' AND v_old_status <> 'cancelled' AND v_employee_id IS NOT NULL THEN
      INSERT INTO notifications (audience, category, notification_type, recipient_employee_id, title, body, link, read, metadata)
      VALUES ('worker', 'visit', 'visit_cancelled', v_employee_id, 'تم إلغاء الزيارة',
        'تم إلغاء زيارة العميل ' || v_client_name || ' المقررة في ' || v_scheduled_date,
        '/worker/visits', false, v_metadata);

    ELSIF v_employee_id IS NOT NULL
      AND (OLD.employee_id IS NULL OR OLD.employee_id <> v_employee_id)
      AND v_new_status <> 'cancelled' THEN
      INSERT INTO notifications (audience, category, notification_type, recipient_employee_id, title, body, link, read, metadata)
      VALUES ('worker', 'visit', 'visit_assigned', v_employee_id, 'زيارة جديدة',
        'تمت إضافة زيارة جديدة لك.' || E'\n' || 'العميل: ' || v_client_name || E'\n' ||
        'التاريخ: ' || v_scheduled_date,
        '/worker/visits', false, v_metadata);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notification creation failed (non-blocking): %', SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;
