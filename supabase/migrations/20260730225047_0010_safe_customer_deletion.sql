/*
# Safe Customer Deletion with Financial Archive

## Purpose
Allow administrators to safely delete customers while preserving historical financial records (invoices, payments) for accounting integrity.

## Changes
1. Add `archived` boolean column to `invoices` table (default false) — marks invoices from deleted customers
2. Add `archive_reason` text column to `invoices` table — stores reason like "Archived – Customer Deleted"
3. Add `archived` boolean column to `payments` table (default false)
4. Add `archive_reason` text column to `payments` table
5. Change `contracts.client_id` FK from ON DELETE RESTRICT to ON DELETE SET NULL
   so that when a customer is deleted, their contracts are removed (visits cascade),
   but invoices keep their financial data with client_id set to null
6. Add `archived_client_name` text column to `invoices` to preserve the client name after deletion

## Security
- No RLS policy changes (existing policies remain in effect)
- All new columns are nullable with safe defaults

## Notes
- Invoices and payments are preserved with archived=true and the original client name stored
- Contracts, visits, QR codes, notifications, and opportunities are cleaned up via cascade or explicit deletion
- Financial reports can filter on archived status to show/hide deleted-customer records
*/

-- Add archive columns to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS archived_client_name text;

-- Add archive columns to payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- Change contracts.client_id FK from RESTRICT to SET NULL
-- This allows customer deletion while preserving contract-derived invoice data
ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_client_id_fkey,
  ADD CONSTRAINT contracts_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- Add index on archived columns for efficient filtering
CREATE INDEX IF NOT EXISTS idx_invoices_archived ON invoices(archived);
CREATE INDEX IF NOT EXISTS idx_payments_archived ON payments(archived);
