# Production Schema Baseline

**Snapshot date:** 2026-08-06 22:13:42 UTC
**Database project reference:** xseufygprxiiakkfezsd
**Applied migrations:** 39
**Tables:** 42 (41 public + 1 backup marker)

This document captures the current production database schema state as the authoritative starting point for all future remediation migrations.

---

## Tables (41 public tables)

| Table | Columns | RLS Enabled | Row Estimate |
|---|---|---|---|
| _backup_markers | 7 | YES | 1 |
| activity_timeline | 8 | YES | 82 |
| attachments | 8 | YES | 0 |
| audit_logs | 8 | YES | 52 |
| client_activation_codes | 8 | YES | 4 |
| client_emergency_contacts | 7 | YES | 0 |
| client_medical | 6 | YES | 0 |
| client_otps | 8 | YES | 0 |
| client_pins | 10 | YES | 2 |
| client_sessions | 6 | YES | 3 |
| clients | 23 | YES | 5 |
| companies | 10 | YES | 1 |
| contract_attachments | 5 | YES | 0 |
| contract_payments | 9 | YES | 1 |
| contract_timeline | 7 | YES | 10 |
| contracts | 23 | YES | 5 |
| employee_availability | 5 | YES | 0 |
| employee_leave | 7 | YES | 0 |
| employees | 31 | YES | 1 |
| expenses | 14 | YES | 1 |
| inventory_assignments | 7 | YES | 0 |
| inventory_categories | 5 | YES | 0 |
| inventory_items | 16 | YES | 0 |
| inventory_movements | 7 | YES | 0 |
| invoices | 15 | YES | 0 |
| lead_activities | 7 | YES | 3 |
| leads | 21 | YES | 5 |
| notifications | 10 | YES | 28 |
| opportunities | 21 | YES | 1 |
| packages | 8 | YES | 1 |
| payments | 10 | YES | 0 |
| payroll | 13 | YES | 0 |
| permissions | 5 | YES | 27 |
| profiles | 15 | YES | 2 |
| qr_codes | 8 | YES | 5 |
| qr_sequence | 3 | YES | 1 |
| role_permissions | 3 | YES | 81 |
| roles | 5 | YES | 12 |
| service_requests | 12 | YES | 0 |
| settings | 15 | YES | 15 |
| visit_ratings | 8 | YES | 0 |
| visits | 22 | YES | 25 |

---

## RLS Status

**RLS is ENABLED on ALL 41 public tables** (plus the `_backup_markers` table).

---

## RLS Policies

See the full policy table in the database. Key patterns:
- **client_otps, client_sessions, qr_sequence**: No policies — locked to service role only
- **audit_logs**: SELECT restricted to admins via `is_current_user_admin()`
- **payroll, expenses, contract_payments, payments**: Restricted to `has_app_permission('finance')`
- **leads, lead_activities, opportunities**: Restricted to `has_app_permission('sales')`
- **roles, permissions, role_permissions**: Writes restricted to `is_super_admin()`
- **employees**: Reads open to all authenticated staff, writes require `has_app_permission('employees')`
- **clients**: Reads open to authenticated, writes require `has_app_permission('clients')`, anon revoked
- **notifications**: Scoped by `recipient_employee_id` or admin audience

---

## Database Functions (13 total)

### SECURITY DEFINER (12)
- client_id_by_phone, client_portal_bootstrap, client_portal_update_profile, current_user_employee_id, get_client_id_from_token, get_next_qr_sequence, has_app_permission, is_current_user_admin, is_super_admin, notify_visit_modified, notify_visit_status_change, record_contract_payment

### SECURITY INVOKER (1)
- normalize_client_phone (trigger function)

---

## Triggers (3)
- clients: trg_normalize_client_phone (BEFORE INSERT/UPDATE)
- visits: trg_notify_visit_modified (AFTER UPDATE)
- visits: trg_notify_visit_status (AFTER INSERT/UPDATE)

---

## Realtime / Publications

### supabase_realtime Publication
- **Publication exists:** YES
- **Tables in publication:** NONE (0 tables)

### Application Realtime Subscriptions vs Database Configuration

| Table | App Subscribes? | In Realtime Publication? | Status |
|---|---|---|---|
| visits | YES | NO | SUBSCRIBED IN CODE BUT NOT ENABLED IN DATABASE |
| notifications | YES | NO | SUBSCRIBED IN CODE BUT NOT ENABLED IN DATABASE |
| contracts | YES | NO | SUBSCRIBED IN CODE BUT NOT ENABLED IN DATABASE |
| invoices | YES | NO | SUBSCRIBED IN CODE BUT NOT ENABLED IN DATABASE |
| payments | YES | NO | SUBSCRIBED IN CODE BUT NOT ENABLED IN DATABASE |
| service_requests | YES | NO | SUBSCRIBED IN CODE BUT NOT ENABLED IN DATABASE |

**All 6 tables that the application subscribes to via Realtime are NOT enabled in the database publication.** Realtime features are non-functional.

---

## Extensions

| Extension | Version |
|---|---|
| pg_stat_statements | 1.11 |
| pgcrypto | 1.3 |
| plpgsql | 1.0 |
| supabase_vault | 0.3.1 |
| uuid-ossp | 1.1 |
