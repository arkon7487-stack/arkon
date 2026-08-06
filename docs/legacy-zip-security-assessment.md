# Legacy ZIP Security Assessment

## ZIP File Details

| Field | Value |
|---|---|
| Filename | `project-bolt-sb1-v7eedaue (2).zip` |
| Size | 1.76 MB |
| Files contained | 125 |
| Present on branches | `main`, `web-production-baseline-before-mobile` |
| Present in local workspace | YES |

## Secrets Found

| # | File in ZIP | Secret Type | Rotation Required |
|---|---|---|---|
| 1 | `project/.env` | Production Supabase URL + anon key (real values) | YES |
| 2 | `project/supabase/migrations/20260730152240_create_admin_user.sql` | Admin password (bcrypt-hashed via crypt()) | YES |
| 3 | `project/supabase/migrations/20260730154011_create_islam_admin_and_defaults.sql` | Admin password (bcrypt-hashed via crypt()) | YES |
| 4 | `project/supabase/functions/arkon-admin-setup/index.ts` | Admin password (plaintext constant `ADMIN_PASSWORD`) | YES |

## Credentials Requiring Rotation

1. **Supabase anon key** — exposed in `.env` inside the ZIP, committed to Git history
2. **admin@arkon.enterprise password** — hardcoded in migration SQL, committed to Git history
3. **islam@gmail.com password** — hardcoded in migration SQL, committed to Git history

## Historical Exposure

- The ZIP was uploaded to the `main` branch on 2026-08-01 via GitHub web upload
- The ZIP was included in the baseline branch when it was created on 2026-08-06
- Both branches contain the full ZIP in their commit history
- The `.env` file inside the ZIP contains real production credentials
- The migration SQL files inside the ZIP contain hardcoded admin passwords
- The `arkon-admin-setup` edge function (only in the ZIP, not deployed) contains a plaintext admin password

## Actions Taken in Batch 1

- Documented all secrets and their locations
- No files deleted, no history rewritten
- ZIP remains on both branches untouched

## Actions Required in Future Batches

1. **Batch 2:** Rotate both admin passwords and the Supabase anon key
2. **Batch 3:** Remove the ZIP from the `backend-security-remediation` branch (NOT from the frozen baseline)
3. **Future phase:** Rewrite Git history to purge the ZIP and `.env` from all historical commits
4. **Future phase:** Add `.env` and `*.zip` to `.gitignore` permanently
