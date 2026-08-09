/*
# ARKON Workflow Redesign — Schema Changes

## Summary
This migration adds support for the redesigned ARKON workflow:
1. Permanent customer QR codes with sequential format (ARKON-C000001)
2. Employee job_title field for role suggestion
3. Client status workflow (lead, contacted, won, active, archived)
4. Sequence counter for QR code generation

## New Tables
- `qr_sequence` — Counter table for generating sequential QR codes

## Modified Tables
- `employees` — Add `job_title` text column
- `qr_codes` — Add `sequence_number` integer column

## Security
- RLS enabled on `qr_sequence` with authenticated CRUD
*/

-- ===== QR Sequence Counter =====
CREATE TABLE IF NOT EXISTS qr_sequence (
  id integer PRIMARY KEY DEFAULT 1,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO qr_sequence (id, last_number) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE qr_sequence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_qr_sequence" ON qr_sequence;
CREATE POLICY "read_qr_sequence" ON qr_sequence FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "update_qr_sequence" ON qr_sequence;
CREATE POLICY "update_qr_sequence" ON qr_sequence FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ===== Employee job_title =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'job_title') THEN
    ALTER TABLE employees ADD COLUMN job_title text;
  END IF;
END $$;

-- ===== QR code sequence number =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qr_codes' AND column_name = 'sequence_number') THEN
    ALTER TABLE qr_codes ADD COLUMN sequence_number integer;
  END IF;
END $$;

-- ===== Function to get next QR sequence number =====
CREATE OR REPLACE FUNCTION get_next_qr_sequence()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE qr_sequence SET last_number = last_number + 1, updated_at = now()
  WHERE id = 1
  RETURNING last_number;
$$;
