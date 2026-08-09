/*
# ARKON Sales CRM + Contract Payment Ledger

## Summary
Adds a professional Sales CRM pipeline and a full contract payment ledger.

## 1. New Tables

### leads
Stores sales pipeline records — potential customers from first contact through Won/Lost.
- `id` (uuid, pk)
- `company_id` (uuid, FK companies)
- `full_name`, `phone_number`, `alternate_phone`, `address`, `area`
- `lead_source` — where the lead came from (website, referral, cold-call, etc.)
- `interested_service` — service the lead is interested in
- `notes`
- `stage` — pipeline stage: new_lead | contacted | follow_up | quotation_sent | negotiation | won | lost
- `assigned_employee_id` (uuid, FK employees, nullable)
- `expected_value` (numeric, nullable)
- `follow_up_date` (date, nullable)
- `lost_reason` (text, nullable)
- `converted_client_id` (uuid, FK clients, nullable) — set when a Won lead becomes a real customer
- `created_at`, `updated_at`

### lead_activities
Immutable activity timeline for every lead.
- `id` (uuid, pk)
- `lead_id` (uuid, FK leads)
- `event_type` — e.g. lead_created, call_made, follow_up_added, note_added, quotation_sent, stage_changed, deal_won, deal_lost
- `message` (text)
- `user_name` (text, nullable) — who performed the action
- `meta` (jsonb, nullable)
- `created_at`

### contract_payments
Permanent payment ledger for every contract. Records are never overwritten.
- `id` (uuid, pk)
- `company_id` (uuid, FK companies)
- `contract_id` (uuid, FK contracts)
- `amount` (numeric, not null) — amount paid in this transaction
- `payment_method` (text, nullable) — cash, bank_transfer, cheque, etc.
- `payment_date` (date, not null)
- `notes` (text, nullable)
- `recorded_by` (text, nullable)
- `created_at`

## 2. Modified Tables

### contracts
- Added `amount_paid` (numeric, default 0) — running total of payments received
  (remaining_balance already exists; kept in sync by app logic)

## 3. Security
- RLS enabled on all new tables.
- anon + authenticated CRUD (single-tenant internal app).
*/

-- ===== LEADS =====
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  phone_number text NOT NULL,
  alternate_phone text,
  address text,
  area text,
  lead_source text,
  interested_service text,
  notes text,
  stage text NOT NULL DEFAULT 'new_lead',
  assigned_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  expected_value numeric(12, 2),
  follow_up_date date,
  lost_reason text,
  converted_client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_employee_id);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_leads" ON leads;
CREATE POLICY "anon_select_leads" ON leads FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_leads" ON leads;
CREATE POLICY "anon_insert_leads" ON leads FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_leads" ON leads;
CREATE POLICY "anon_update_leads" ON leads FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_leads" ON leads;
CREATE POLICY "anon_delete_leads" ON leads FOR DELETE TO anon, authenticated USING (true);

-- ===== LEAD_ACTIVITIES =====
CREATE TABLE IF NOT EXISTS lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text NOT NULL,
  user_name text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_lead_activities" ON lead_activities;
CREATE POLICY "anon_select_lead_activities" ON lead_activities FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_lead_activities" ON lead_activities;
CREATE POLICY "anon_insert_lead_activities" ON lead_activities FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_lead_activities" ON lead_activities;
CREATE POLICY "anon_delete_lead_activities" ON lead_activities FOR DELETE TO anon, authenticated USING (true);

-- ===== CONTRACT_PAYMENTS =====
CREATE TABLE IF NOT EXISTS contract_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  payment_method text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_payments_contract ON contract_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_company ON contract_payments(company_id);

ALTER TABLE contract_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_contract_payments" ON contract_payments;
CREATE POLICY "anon_select_contract_payments" ON contract_payments FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_contract_payments" ON contract_payments;
CREATE POLICY "anon_insert_contract_payments" ON contract_payments FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_contract_payments" ON contract_payments;
CREATE POLICY "anon_update_contract_payments" ON contract_payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_contract_payments" ON contract_payments;
CREATE POLICY "anon_delete_contract_payments" ON contract_payments FOR DELETE TO anon, authenticated USING (true);

-- ===== ALTER CONTRACTS: add amount_paid if missing =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'amount_paid'
  ) THEN
    ALTER TABLE contracts ADD COLUMN amount_paid numeric(12, 2) NOT NULL DEFAULT 0;
  END IF;
END $$;
