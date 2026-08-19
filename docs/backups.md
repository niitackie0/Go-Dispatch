# Backups, and getting the data back

A backup nobody has restored is a rumour. This page is mostly about the
restore; the taking of it is automatic.

## What runs

`.github/workflows/backup.yml`, nightly at 02:00 UTC — 2am in Ghana, which is
UTC+0 all year.

It does four things, and the third is the one that matters:

1. `pg_dump` of the Neon database through the **direct** endpoint
2. restores that dump into a throwaway Postgres 18 and **counts the rows**
3. fails the run if the restored copy has no admin accounts — a backup that
   cannot get anyone back into the console is not a backup
4. encrypts with AES-256 and keeps it as a workflow artifact for 90 days

Step 2 is why this is worth having. Plenty of backup jobs produce a file every
night for a year and are discovered, on the one day it matters, to have been
dumping an empty schema. This one proves the file restores before it keeps it.

It runs on GitHub rather than on Render because the Render instance is free and
sleeps, and a cron inside a process that is not running is not a cron. GitHub
also emails you when a scheduled job fails, which is the only reason anyone
ever finds out.

## What it does not do

**It is not permanent.** 90 days is GitHub's maximum artifact retention. Once
there is a year of real deliveries in here, download one a month and put it
somewhere you own — see the last section.

**It is not off-GitHub.** It protects against Neon being lost, the account
lapsing, or somebody dropping a table. It does not protect against losing the
GitHub account.

**The passphrase is not backed up.** If `BACKUP_PASSPHRASE` is lost, every
artifact becomes a file of noise. Keep it in a password manager *and* written
down somewhere physical. Storing it only in GitHub Secrets means it dies with
the same account that holds the backups.

## Setup, once

Repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `DIRECT_URL` | the Neon string **without** `-pooler` in the host |
| `BACKUP_PASSPHRASE` | anything long and random, kept somewhere else too |

Then Actions → **Nightly backup** → **Run workflow**, and watch it go green.
Do that today rather than waiting for 2am — a workflow you have never seen
succeed is not a workflow you have.

---

## Restoring

### Get the file

Actions → the run you want → **Artifacts** → download → unzip.

### Decrypt

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in go-dispatch-2026-08-19.sql.gz.enc \
  -out backup.sql.gz
gunzip backup.sql.gz
```

### Restore into a Neon branch first — never over the live database

Neon branches are copy-on-write and cost nothing to make. Restore into one,
open the console against it, and look at the data with your own eyes before
anything touches production.

1. Neon Console → **Branches** → **New branch**, call it `restore-check`
2. Copy its connection string
3. Load the dump into it:

```bash
psql "postgresql://…restore-check…/neondb?sslmode=verify-full" \
  -v ON_ERROR_STOP=1 -f backup.sql
```

4. Point the app at it and look:

```bash
DATABASE_URL="…restore-check…" DIRECT_URL="…restore-check…" SMS_PROVIDER= npm run dev
```

`SMS_PROVIDER=` empty matters. A restored database carries a restored outbox,
and starting a server with sending switched on will re-send messages about
orders from whenever the dump was taken.

5. Open `/ops`, check the board, open an order, check the payments ledger.

### Only then, the real thing

If the live database is the one that is broken, restore into a **new** branch
and repoint `DATABASE_URL` and `DIRECT_URL` in Render at it. Do not restore
over the damaged database: as long as it exists, you can still go back and look
at it, and the first restore attempt is not always the one that works.

---

## Before there is a year of data

Download one artifact a month and keep it somewhere that is not GitHub — an
external drive, or a bucket you pay for. Two copies in two places, one of them
not on the internet, is the whole of backup strategy.

If you would rather that were automatic, the workflow can push to Cloudflare R2
or S3 instead of an artifact. It is about ten more lines and one more set of
credentials.
