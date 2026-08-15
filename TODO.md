# Waypoint — Work Queue

Ordered by priority. Effort: **S** ≈ under an hour · **M** ≈ half a day · **L** ≈ a day or more.

---

## P0 — Security, do these first

Small jobs, real exposure. None take more than a few minutes.

- [ ] **Rotate the Neon database password** — **S**
  Both connection strings were pasted into a chat, so that credential is in a
  transcript. Neon Console → Roles → `neondb_owner` → Reset password, then
  update the two lines in `.env`. Do this before real customer data exists.

- [ ] **Change the admin password to one you choose** — **S**
  Currently `admin@waypoint.com` / `u8MoA64Xg588wuLH8dvd`, which was generated
  by the seed and has since appeared in a chat transcript. Change it from
  **My Account** in the console, and store the new one in a password manager —
  only a hash is kept, so it cannot be recovered.

- [ ] **Delete the stale `db.json`** — **S**
  Untracked and unread by anything since the Postgres port. It only exists now
  to confuse whoever next opens the folder.

---

## P1 — Current focus: separation and UI

The redesign is the main event. The bundle split comes first because it decides
what the redesign is building into.

- [ ] **Split admin into its own bundle at a private path** — **M**
  Today admin code ships to every customer and sits at the guessable `/admin`.
  New `admin.html` Vite entry + `src/AdminApp.tsx`, path from `ADMIN_PATH` in
  `.env` (default `/ops`). Server rewrites that path to `admin.html` before the
  Vite/static layer. Prerequisite for the redesign — do not skip it and retrofit.

- [ ] **Redesign the customer site** — **L**
  `/`, `/book`, `/track`. This is the shop window: it decides whether someone
  trusts you with a parcel. Booking form and tracking timeline are the two
  screens that matter.
  *Open question: keep the current dark look, or go somewhere new?*

- [ ] **Redesign the admin dashboard** — **L**
  Simple and decluttered, tables over card-grids, lists paginated to 10.
  Must now also be **role-aware**: hide what the signed-in role cannot do.

- [ ] **Rider view redesign** — **M**
  Used one-handed, outdoors, on a phone, possibly in sunlight. Big targets,
  high contrast, minimal text. Easy to forget because you will never use it.

---

## P2 — Before this goes live

- [ ] **SMS notifications** — **L**
  The customer currently never receives their tracking code anywhere except the
  screen they booked on. Five triggers: booking confirmed, payment received,
  rider assigned, out for delivery, delivered.
  Use a Ghanaian provider — **Arkesel, Hubtel or mNotify** — for cost and for a
  registered sender ID, so messages arrive from "WAYPOINT" not a random number.
  **Send from a queue, never inline in the request** — an SMS outage must not
  fail a customer's booking.

- [ ] **Enforce legal status transitions** — **M**
  An admin can currently move an order straight from `requested` to `delivered`.
  The rider path is already constrained; the admin path is not. Add an explicit
  map of permitted transitions and reject the rest.

- [ ] **Deployment** — **L**
  Nothing is hosted yet. Needs a host, env vars set (including `ADMIN_PATH` and
  the rotated `DATABASE_URL`), `prisma migrate deploy` in the release step, and
  a decision on where the automation tick runs.

- [ ] **Recreate `.env.example`** — **S**
  Deleted with the AI Studio cruft, but deployment needs a checklist of required
  variables: `DATABASE_URL`, `DIRECT_URL`, `ADMIN_PATH`, SMS keys later.

- [ ] **Turn on TypeScript `strict`** — **M**
  `tsconfig.json` has no `strict`, so `tsc` catches almost no null/undefined
  bugs. This already bit us once: `stats?.revenue.today` guarded `stats` but not
  `revenue` and would have white-screened the dashboard for two roles. Expect a
  pile of existing errors when you enable it — that is the point.

- [ ] **Two-factor authentication (TOTP)** — **M**
  Authenticator-app codes, at least on `owner` accounts — that role can change
  pricing and create staff. Purely additive: identity already lives in our own
  tables, so this needs no migration and no vendor.

- [ ] **Password reset by email** — **M** — *needs an email provider first*
  Today a forgotten password means asking an owner to issue a new one from the
  Staff tab, which is fine for a small team who can reach each other. Becomes
  necessary as the team grows. Pairs naturally with booking-receipt emails.

- [ ] **Auth audit log** — **M**
  Record sign-ins, failed attempts, password changes and role changes. Orders
  already have `status_history`; account activity has no equivalent, so there is
  currently no way to answer "who changed this, and when".

- [ ] **Write a real README** — **S**
  The AI Studio one was deleted. Needs: what Waypoint is, setup, the route map,
  and the branch model.

- [ ] **Branch protection on `main`** — **S**
  Nothing stops a direct push, which makes `dev → staging → main` decorative.
  GitHub → Settings → Rules → Rulesets. Note: private repos need Pro for this.

---

## P3 — Deferred, deliberately

- [ ] **Automated MoMo payments** — **L** — *parked by you*
  Manual recording works for launch. When automated: Paystack or Hubtel, and the
  critical part is a **signature-verified webhook** — confirmation must come from
  the provider, never the browser. The `providerReference` unique constraint is
  already in place so a replayed webhook cannot double-count.

- [ ] **Tests** — **L**
  There are none. Everything so far was verified by hand against a live database.
  Highest value first: the booking transaction, the permission matrix, and the
  automation rules.

- [ ] **Expired session cleanup** — **S**
  Expired sessions are deleted only when someone happens to present one. Fine at
  this scale; revisit if the table grows.

- [ ] **Error monitoring** — **M**
  Errors currently go to stdout. Once deployed, nobody is reading stdout.

---

## Done

- Git repo, four branches (`main`/`staging`/`dev`/`feature`), pushed to GitHub
- Stripped Google AI Studio scaffolding and unused dependencies
- Neon PostgreSQL 18.4 (London) provisioned; 9 tables, migrations, seed script
- Real auth: Argon2id, sessions in Postgres, CSPRNG tokens, login rate limiting
- Every endpoint ported off `db.json`; `server.ts` 1,170 → 80 lines
- Transactions on all multi-row writes; tracking-code collisions retried
- Fixed a data leak: tracking search matched phone numbers by substring, so
  searching "0" returned nearly every order in the system
- RBAC: four roles, one capability table, staff API with lockout guards
- Staff Accounts screen: add staff, change roles, issue passwords, remove
- My Account screen: change your own password, see where you are signed in,
  revoke individual sessions or every other device
