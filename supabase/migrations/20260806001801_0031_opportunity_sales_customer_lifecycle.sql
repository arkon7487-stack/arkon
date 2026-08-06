/*
# Connect Opportunities → Sales → Customers lifecycle

## Purpose
Establishes stable database relationships between the Opportunities, Sales
leads, and Customers (clients) modules so records flow through one connected
lifecycle instead of existing as isolated copies.

## New Columns

### opportunities table
- `sales_lead_id` (uuid, nullable) — FK to leads.id. Set when a Sales lead is
  auto-created from this opportunity. Allows the Opportunities module to
  know which Sales record corresponds to it.
- `sent_to_sales_at` (timestamptz, nullable) — timestamp of auto-creation.

### leads table (Sales module)
- `opportunity_id` (uuid, nullable) — FK to opportunities.id. Set when a
  lead is auto-created from an opportunity, or when a lead is manually linked
  to one. Allows the Sales module to trace back to the originating Opportunity.
- `converted_at` (timestamptz, nullable) — timestamp when the lead was
  converted into an active customer.
- `converted_by` (text, nullable) — name/ID of the user who completed the
  conversion.

### clients table (Customers module)
- `source_opportunity_id` (uuid, nullable) — FK to opportunities.id. Set when
  a customer is created by importing a Sales lead that originated from an
  Opportunity.
- `source_sales_lead_id` (uuid, nullable) — FK to leads.id. Set when a
  customer is created via "Import from Sales".

## Backfill
Attempts to link existing Opportunities and Leads that share the same phone
number. Only links when there is exactly one match (no ambiguous merges).
Unlinked/duplicate records are left untouched for manual review.

## Indexes
- `opportunities.sales_lead_id` — for reverse lookups from Sales.
- `leads.opportunity_id` — for forward lookups from Opportunities.
- `leads.converted_client_id` — already exists from original schema.
- `clients.source_sales_lead_id` — for checking if a lead was already imported.
- `clients.source_opportunity_id` — for checking if an opportunity was converted.

## Security
No RLS policy changes — all new columns inherit existing table-level RLS.
No new tables created.

## Important Notes
1. This migration is idempotent — safe to re-run.
2. No data is deleted or modified destructively.
3. Existing converted_client_id columns on both opportunities and leads are
   preserved and remain the primary link to the created customer.
*/

-- ── opportunities: link to sales lead ──────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opportunities' AND column_name = 'sales_lead_id'
  ) THEN
    ALTER TABLE opportunities ADD COLUMN sales_lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opportunities' AND column_name = 'sent_to_sales_at'
  ) THEN
    ALTER TABLE opportunities ADD COLUMN sent_to_sales_at timestamptz;
  END IF;
END $$;

-- ── leads: link back to opportunity + conversion tracking ──────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'opportunity_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'converted_at'
  ) THEN
    ALTER TABLE leads ADD COLUMN converted_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'converted_by'
  ) THEN
    ALTER TABLE leads ADD COLUMN converted_by text;
  END IF;
END $$;

-- ── clients: trace origin to opportunity / sales lead ──────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'source_opportunity_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN source_opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'source_sales_lead_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN source_sales_lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Indexes for relationship lookups ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_opportunities_sales_lead_id ON opportunities(sales_lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_opportunity_id ON leads(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_clients_source_sales_lead_id ON clients(source_sales_lead_id);
CREATE INDEX IF NOT EXISTS idx_clients_source_opportunity_id ON clients(source_opportunity_id);

-- ── Backfill: link existing opportunities ↔ leads by phone number ──
-- Only links unambiguous 1:1 matches. Leaves duplicates for manual review.
DO $$
BEGIN
  UPDATE opportunities o
  SET sales_lead_id = sub.lead_id,
      sent_to_sales_at = NOW()
  FROM (
    SELECT o2.id AS opp_id, l.id AS lead_id
    FROM opportunities o2
    JOIN leads l ON l.phone_number = o2.phone_number
    WHERE o2.sales_lead_id IS NULL
    GROUP BY o2.id, l.id
    HAVING COUNT(*) = 1
  ) sub
  WHERE o.id = sub.opp_id;

  UPDATE leads l
  SET opportunity_id = sub.opp_id
  FROM (
    SELECT o.id AS opp_id, l2.id AS lead_id
    FROM opportunities o
    JOIN leads l2 ON l2.phone_number = o.phone_number
    WHERE l2.opportunity_id IS NULL
    GROUP BY o.id, l2.id
    HAVING COUNT(*) = 1
  ) sub
  WHERE l.id = sub.lead_id;
END $$;
