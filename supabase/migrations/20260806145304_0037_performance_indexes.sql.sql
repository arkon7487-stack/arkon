-- HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY
-- Recovered from supabase_migrations.schema_migrations statements column
-- Original migration: 20260806145304_0037_performance_indexes.sql

/*
# Database Indexes — Performance Optimization
*/

-- Visits: most common filters
CREATE INDEX IF NOT EXISTS idx_visits_employee_date ON visits (employee_id, scheduled_date DESC)
;

CREATE INDEX IF NOT EXISTS idx_visits_status ON visits (status) WHERE status IN ('scheduled', 'started')
;

CREATE INDEX IF NOT EXISTS idx_visits_contract ON visits (contract_id)
;

CREATE INDEX IF NOT EXISTS idx_visits_date ON visits (scheduled_date DESC)
;


-- Contracts: common filters
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts (client_id)
;

CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts (status)
;


-- Invoices: common filters
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices (contract_id)
;

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status)
;


-- Payments: linked by invoice_id
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments (invoice_id)
;


-- Opportunities: phone lookup for duplicate checking
CREATE INDEX IF NOT EXISTS idx_opportunities_phone ON opportunities (phone_number)
;

CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities (status)
;


-- Clients: phone lookup
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients (phone_number)
;


-- Employees: common filters
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees (employment_status)
;


-- Service requests: status filter
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests (status)
;


-- Audit logs: date sorting
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC)
;


-- Activity timeline: entity + date
CREATE INDEX IF NOT EXISTS idx_activity_timeline_entity ON activity_timeline (entity_type, entity_id, created_at DESC)
;

