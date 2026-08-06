# Production Migration History

## Overview

Production database has **39 applied migrations**. As of Batch 1, all 39 migration source files have been recovered and committed to the `backend-security-remediation` branch.

- **19 migrations** were already present in the GitHub baseline (`web-production-baseline-before-mobile`)
- **20 migrations** were missing from GitHub but recovered from the `supabase_migrations.schema_migrations.statements` column (which stores the original executed SQL)
- **0 migrations** are unrecoverable

All 20 recovered files are marked with a `HISTORICAL — ALREADY APPLIED IN PRODUCTION — DO NOT REPLAY` header and must never be re-executed.

## Complete Migration List

| # | Version | Name | Source | Status |
|---|---|---|---|---|
| 1 | 20260730143421 | 0001_arkon_core_schema | GitHub baseline | ORIGINAL |
| 2 | 20260730144714 | 0002_arkon_business_modules | GitHub baseline | ORIGINAL |
| 3 | 20260730152240 | create_admin_user | GitHub baseline | ORIGINAL (contains hardcoded password) |
| 4 | 20260730154011 | create_islam_admin_and_defaults | GitHub baseline | ORIGINAL (contains hardcoded password) |
| 5 | 20260730182048 | 0003_arkon_workflow_redesign | GitHub baseline | ORIGINAL |
| 6 | 20260730195949 | 0004_arkon_rbac | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 7 | 20260730201137 | 0005_arkon_rbac_missing_roles | GitHub baseline | ORIGINAL |
| 8 | 20260730202538 | 0006_arkon_enterprise_modules | GitHub baseline | ORIGINAL |
| 9 | 20260730215418 | 0007_arkon_quotation_support | GitHub baseline | ORIGINAL |
| 10 | 20260730220922 | 0008_arkon_salary_payroll | GitHub baseline | ORIGINAL |
| 11 | 20260730221311 | 0009_arkon_expense_employee_link | GitHub baseline | ORIGINAL |
| 12 | 20260730225047 | 0010_safe_customer_deletion | GitHub baseline | ORIGINAL |
| 13 | 20260731175531 | 20260731_0011_sales_and_payments | GitHub baseline | ORIGINAL |
| 14 | 20260731214126 | 0012_security_permission_helpers | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 15 | 20260731214144 | 0013_lock_client_otps_and_sessions | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 16 | 20260731214232 | 0014_client_portal_token_access | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 17 | 20260731214310 | 0015_restrict_client_pii_to_staff | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 18 | 20260731214338 | 0016_restrict_payroll_to_finance | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 19 | 20260731214407 | 0017_restrict_contract_payments | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 20 | 20260731214437 | 0018_restrict_leads_to_sales | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 21 | 20260731214508 | 0019_lock_rbac_tables | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 22 | 20260731214616 | 0020_protect_contract_financials | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 23 | 20260731214727 | 0021_gate_employee_and_settings_writes | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 24 | 20260731214757 | 0022_harden_qr_sequence_function | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 25 | 20260731215305 | 0023_client_portal_profile_and_minimal_employee | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 26 | 20260731215728 | 0024_normalize_client_phone_numbers | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 27 | 20260731215810 | 0025_revoke_public_execute_on_definer_helpers | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 28 | 20260731215900 | 0026_drop_leftover_permissive_policies | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 29 | 20260805203228 | 0027_record_contract_payment_caller | GitHub baseline | ORIGINAL |
| 30 | 20260805222503 | 0028_service_requests_and_visit_ratings | GitHub baseline | ORIGINAL |
| 31 | 20260806001503 | 0030_fix_numeric_column_types | GitHub baseline | ORIGINAL |
| 32 | 20260806001801 | 0031_opportunity_sales_customer_lifecycle | GitHub baseline | ORIGINAL |
| 33 | 20260806005647 | 0032_restore_sales_permission | GitHub baseline | ORIGINAL |
| 34 | 20260806010908 | 0033_customer_pin_auth | GitHub baseline | ORIGINAL |
| 35 | 20260806141135 | 0034_client_portal_rls_and_public_request | GitHub baseline | ORIGINAL |
| 36 | 20260806144036 | 0035_realtime_notification_system | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 37 | 20260806145202 | 0036_rls_hardening_stage2 | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 38 | 20260806145227 | 0036b_revoke_public_execute | Recovered from DB | ORIGINAL SOURCE RECOVERED |
| 39 | 20260806145304 | 0037_performance_indexes | Recovered from DB | ORIGINAL SOURCE RECOVERED |

## Recovery Method

The 20 missing migration source files were recovered from the `statements` column of the `supabase_migrations.schema_migrations` table. This column stores an array of SQL statement strings that were executed when the migration was applied, preserving the original SQL.

No migration SQL was fabricated or reconstructed from schema inspection. All recovered SQL is the exact original SQL that was executed against production.

## Missing Migration Numbers

- **0029**: No migration with version 20260805222503...0029 exists. The numbering jumps from 0028 to 0030. This is not a missing file — no migration 0029 was ever created.
- **0004**: Exists in production but was not in the GitHub baseline. Now recovered.

## Migrations Containing Hardcoded Secrets

| Migration | Secret Type | Action Required |
|---|---|---|
| 20260730152240_create_admin_user.sql | Admin password (bcrypt-hashed) | Rotate password in Batch 2 |
| 20260730154011_create_islam_admin_and_defaults.sql | Admin password (bcrypt-hashed) | Rotate password in Batch 2 |

These files are already applied and will not re-run. The hardcoded passwords are compromised and must be rotated in a future batch.
