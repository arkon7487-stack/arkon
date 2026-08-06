-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260731215728_0024_normalize_client_phone_numbers

/*
  # Canonical customer phone numbers (F24)

  Portal login and customer lookup key on `clients.phone_number`, which had no
  canonical form and no uniqueness, so two records differing only by spacing,
  dashes or bidi marks could both exist and a lookup could land on the wrong
  customer.

  1. Changes
     - Trim stored phone numbers of whitespace and bidi marks
     - Trigger to normalise `phone_number` on every insert/update
     - Unique index on the digits-only form of the number
     - `client_id_by_phone(text)` resolves a number in canonical form
;
 callable
       only by the service role (used by the portal login function)

  2. Notes
     - Verified beforehand that no two existing customers share a digits-only
       phone number, so the unique index cannot fail on current data.
*/

UPDATE public.clients
SET phone_number = btrim(regexp_replace(phone_number, '[\s\u200e\u200f]+', '', 'g'))
WHERE phone_number IS DISTINCT FROM btrim(regexp_replace(phone_number, '[\s\u200e\u200f]+', '', 'g'))
;


CREATE OR REPLACE FUNCTION public.normalize_client_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL THEN
    NEW.phone_number := btrim(regexp_replace(NEW.phone_number, '[\s\u200e\u200f]+', '', 'g'))
;

  END IF
;

  RETURN NEW
;

END $$
;


DROP TRIGGER IF EXISTS trg_normalize_client_phone ON public.clients
;

CREATE TRIGGER trg_normalize_client_phone
BEFORE INSERT OR UPDATE OF phone_number ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.normalize_client_phone()
;


CREATE UNIQUE INDEX IF NOT EXISTS clients_phone_digits_unique
ON public.clients ((regexp_replace(phone_number, '[^0-9]', '', 'g')))
WHERE phone_number IS NOT NULL
;


CREATE OR REPLACE FUNCTION public.client_id_by_phone(p_phone text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.id
  FROM public.clients c
  WHERE regexp_replace(c.phone_number, '[^0-9]', '', 'g')
        = regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g')
    AND regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g') <> ''
  LIMIT 1
;

$$
;


REVOKE ALL ON FUNCTION public.client_id_by_phone(text) FROM PUBLIC
;

REVOKE ALL ON FUNCTION public.client_id_by_phone(text) FROM anon, authenticated
;

GRANT EXECUTE ON FUNCTION public.client_id_by_phone(text) TO service_role
;

