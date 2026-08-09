/*
# ARKON — Custom Quotation Support

## Summary
Makes contracts.package_id nullable so that custom quotation contracts can be created
without a package. Adds a contract_type column to distinguish standard package contracts
from custom quotation contracts.

## Modified Tables
- `contracts`
  - `package_id` changed from NOT NULL to NULLABLE (allows custom quotation contracts)
  - `contract_type` column added (text, default 'standard', values: 'standard' | 'quotation')

## Security
- No RLS policy changes needed — existing policies already cover all rows.
*/

-- Make package_id nullable
ALTER TABLE contracts ALTER COLUMN package_id DROP NOT NULL;

-- Add contract_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'contract_type'
  ) THEN
    ALTER TABLE contracts ADD COLUMN contract_type text NOT NULL DEFAULT 'standard';
  END IF;
END $$;
