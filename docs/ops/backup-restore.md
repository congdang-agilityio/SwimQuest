# Production database backup and restore

Railway's Basic plan has no backups, so production Postgres (`Postgres-mdE1`) is backed up by a GitHub Actions workflow.

## What runs and when

- Workflow: `.github/workflows/db-backup.yml` ("Production DB backup").
- Schedule: daily at 19:00 UTC (02:00 Vietnam time). It can also be started by hand.
- It runs `pg_dump --format=custom --no-owner --no-acl`, encrypts the dump with GPG (AES256), checks that the file is not empty and that the decrypted copy can be read by `pg_restore --list`, then uploads it as the artifact `swimquest-prod-YYYY-MM-DD`.
- Retention: 30 days (GitHub deletes older artifacts). Runs never overlap.
- The repository is public, so artifacts are readable by anyone. Only the encrypted file is uploaded; no clear-text dump ever leaves the runner.
- Scheduled workflows are paused by GitHub after 60 days without repository activity. Check the Actions tab now and then.

## One-time setup (stakeholder)

### 1. Get the public Postgres URL from Railway

1. Open the Railway project, environment `production`, service `Postgres-mdE1`.
2. Settings -> Networking: enable Public Networking / TCP Proxy (GitHub runners cannot reach the private network).
3. Variables tab: copy `DATABASE_PUBLIC_URL`.

### 2. Add the two secrets in GitHub

Repository -> Settings -> Secrets and variables -> Actions -> New repository secret:

| Name | Value |
| --- | --- |
| `PROD_DATABASE_URL` | the `DATABASE_PUBLIC_URL` value from Railway |
| `BACKUP_PASSPHRASE` | a long random passphrase (for example 32+ random characters from a password manager) |

**Keep the passphrase in a password manager. Without it the backups cannot be decrypted and are useless.** GitHub never shows a secret again after saving it. If the passphrase changes, older artifacts still need the old one.

If either secret is missing, the workflow fails at its first step with a clear message.

## Manual run

Actions tab -> "Production DB backup" -> Run workflow (branch `main`). Or: `gh workflow run db-backup.yml`.

## Download and restore

1. Actions tab -> open a run -> Artifacts -> download `swimquest-prod-YYYY-MM-DD` (a zip), or `gh run download <run-id> -n swimquest-prod-YYYY-MM-DD`.
2. Unzip, then decrypt (you are asked for the passphrase):

   ```bash
   gpg -d swimquest-prod-YYYY-MM-DD.pgdump.gpg > swimquest.pgdump
   pg_restore --list swimquest.pgdump | head   # sanity check
   ```

3. Restore into an empty or disposable database first to check it:

   ```bash
   pg_restore --clean --if-exists --no-owner -d "<target-database-url>" swimquest.pgdump
   ```

   The command in plain form is `pg_restore --clean --no-owner -d <url>`; `--if-exists` just avoids errors on an empty target. Use a `pg_restore` of version 17 or newer.
4. Delete `swimquest.pgdump` afterwards: it is not encrypted.

Restoring over live production replaces its data (`--clean` drops objects first). Stop the app and take a fresh backup before doing it.
