# Production Backup Verification

## Database Project

| Field | Value |
|---|---|
| Project reference | xseufygprxiiakkfezsd |
| Supabase URL | https://xseufygprxiiakkfezsd.supabase.co |
| Postgres start time | 2026-07-30 13:02:32 UTC |
| wal_level | logical |

## Backup Mechanism

This database is a **Bolt-managed Supabase database** (created through Bolt's built-in database system, not a standalone Supabase project).

### Bolt Version History (Application-Level Backups)

Bolt provides automatic **project version history** — snapshots of the entire Bolt project (code + configuration) saved automatically. These can be restored via Bolt's "View history" feature.

**However:** Bolt's version history does **NOT** restore the Supabase database. Restoring a Bolt project version only restores the code, not the database state.

Source: https://support.bolt.new/building/using-bolt/rollback-backup#version-history-and-database-restores

### Supabase Managed Backups

For Bolt-managed Supabase databases, Supabase's standard backup mechanisms apply:

1. **Daily automatic backups:** Supabase Pro tier includes daily automatic backups. Free tier does **NOT** include managed backups.
2. **Point-in-Time Recovery (PITR):** Available on Supabase Pro tier and above. Requires `wal_level = replica` or higher (this database has `logical`, which satisfies the requirement). PITR is **NOT available on the Free tier**.
3. **Logical replication:** This database has `wal_level = logical`, which is the highest WAL level and supports both PITR and logical replication.

### Verification Status

| Item | Status | Notes |
|---|---|---|
| Latest actual managed backup timestamp | UNVERIFIABLE FROM SQL | Bolt/Supabase managed backups are not queryable via SQL. |
| Backup mechanism | Bolt Version History + Supabase managed | Bolt handles project-level backups; Supabase handles database-level backups depending on tier. |
| Backup retention period | UNKNOWN | Depends on Bolt/Supabase plan tier. |
| PITR available | DEPENDS ON TIER | `wal_level = logical` supports PITR, but the plan tier must include it. |
| Earliest recoverable point | UNKNOWN | Not queryable from SQL. |
| Latest recoverable point | NOW (if backups active) | Not queryable from SQL. |
| Full restore procedure | Via Bolt Settings or Supabase Dashboard | Bolt: Settings -> Backups -> Load. Supabase: Dashboard -> Database -> Backups -> Restore. |
| Restore creates new project or overwrites | Bolt: creates a fork. Supabase: creates a new project (does not overwrite). | |
| Expected downtime | 5-15 minutes for restore | Database unavailable during restore. |
| Limitations | Bolt version history does NOT restore database. | Database restore must be done through Supabase Dashboard or pg_dump. |

## Internal Backup Marker

A `_backup_markers` table was created in the database as a metadata record:

| Field | Value |
|---|---|
| Backup ID | PHASE1-BASELINE-20260806-101342 |
| Created at | 2026-08-06 22:13:42 UTC |
| Migration count | 39 |
| Table count | 42 |
| Total rows | 386 |
| RLS | Enabled (no access to anon/authenticated) |

This is a **marker record only**, not a data backup.

## Recommended Pre-Remediation Action

Before executing any destructive migration in Phase 2, a **manual `pg_dump` backup** should be taken to ensure a verifiable restore point exists.

## Conclusion

An actual managed production backup **cannot be verified from within the database** via SQL. The backup infrastructure is managed by Bolt/Supabase at the platform level. The `_backup_markers` table is a metadata marker, not a backup.

**For Phase 2 safety:** Before executing any migration that modifies RLS or credentials, verify through the Supabase Dashboard that a recent backup exists, or take a manual `pg_dump` backup.
