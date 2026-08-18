# GO DISPATCH — Work Queue

Ordered by priority. Effort: **S** ≈ under an hour · **M** ≈ half a day · **L** ≈ a day or more.

---

## P0 — Security, do these first

Small jobs, real exposure. Three are yours; the tooling for them is built.

Step-by-step for the two rotations: **docs/rotating-credentials.md**.

- [ ] **Rotate the Neon database password** — **S**
  Both connection strings were pasted into a chat, so that credential is in a
  transcript. Neon Console → Roles → `neondb_owner` → Reset password, then
  update `DATABASE_URL` and `DIRECT_URL` in `.env` (the pooled host ends in
  `-pooler`, the direct one does not — see `.env.example`). Confirm it worked
  with `npm run admin list`, which fails loudly if it cannot connect.

- [ ] **Roll the Arkesel API key** — **S**
  Same problem, same fix: it arrived over chat. Arkesel dashboard → new key →
  `SMS_API_KEY` in `.env`. Do it before switching sending on, not after.

- [ ] **Add a second owner when there is somebody to add** — **S**
  `annanrichard26@gmail.com` is now the only owner, and the app refuses to
  delete or demote a last owner, so the account cannot be locked out by a
  mistake in the console. The way back in if that password is ever lost is
  `npm run admin password annanrichard26@gmail.com`, which works without being
  signed in. Worth a second owner anyway once a colleague needs access.

---

## P1 — Interface

The visual direction is settled: the GO DISPATCH red and white from the printed
flyer. The console and the customer site have both had the mobile and type pass.

- [ ] **Rider view** — **M**
  The only screen that never got a proper pass. It inherited the red but still
  reads as the old product, and it is the one screen used one-handed, outdoors,
  in sunlight. Wants large type, high contrast and few, obvious controls.

---

## P2 — Before this goes live

- [ ] **Turn SMS sending on** — **S** — *two steps, both yours*
  The sender is built and the account is confirmed: Arkesel, 466 credits, key in
  `.env`. Six events earn a message (see the header of
  `src/server/notifications.ts`), every template fits one billed segment, and a
  worker drains the outbox every 30s with backoff, giving up after five
  attempts. It stays OFF until `SMS_PROVIDER=arkesel` is set.

  Before setting it:
  1. **Clear the stale queue.** Three confirmations from the 16 Aug test
     bookings are still pending to a real number, and would send the moment it
     is enabled. `npm run sms:outbox` lists them.
  2. **Register the sender ID** "GO DISPATCH" with Arkesel. Until it is
     approved, messages arrive from a shortcode, so every template carries a
     13-character "GO DISPATCH: " prefix to say who it is from. Once approved,
     flip `SMS_SENDER_ID_REGISTERED` in `src/brand.ts` and every message gets
     those characters back.

  Also outstanding: the API key was pasted into a chat, so roll it in the
  Arkesel dashboard before real customer traffic runs through it.

- [ ] **Deployment** — **L**
  Nothing is hosted yet. Needs a host, env vars set (including `ADMIN_PATH` and
  the rotated `DATABASE_URL`), `prisma migrate deploy` in the release step, and
  a decision on where the automation tick runs.

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

- [ ] **Session cleanup on role/name edits from Staff Accounts** — **S**
  A role change already takes effect immediately (checked live on every
  request), so no session action is needed there. Worth a second look if
  self-service profile edits are added later.

- [ ] **Auth audit log** — **M**
  Record sign-ins, failed attempts, password changes and role changes. Orders
  already have `status_history`; account activity has no equivalent, so there is
  currently no way to answer "who changed this, and when".

- [ ] **Write a real README** — **S**
  The AI Studio one was deleted. Needs: what GO DISPATCH is, setup, the route map,
  and the branch model.

- [ ] **Branch protection on `main`** — **S**
  Nothing stops a direct push, which makes `dev → staging → main` decorative.
  GitHub → Settings → Rules → Rulesets. Note: private repos need Pro for this.

---

## Parked, and sellable

- **Reports pack** — *lifted out of `dev`, lives on `feature-reports-pack`*
  The Reports tab and `/api/reports`: a date range, a summary of orders,
  delivered, cancelled and revenue for it, and three server-generated CSVs
  (payments, orders, a daily summary) built from the whole range rather than
  from whatever the console had loaded.

  Removed from `dev` deliberately, not because it was wrong. It is the most
  self-contained thing in the codebase — six touchpoints, nothing else depends
  on it — and it is the sort of thing a business asks for once they have a few
  months of data and an accountant. Nothing operational was lost: the payments
  ledger keeps its own **Export CSV**.

  To put it back: `git merge feature-reports-pack`. The branch carries a revert
  of the removal, so the merge restores the files, the router mount and the nav
  entry in one step. Rebase it onto `dev` first if the console has moved on.

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
- Mobile pass over the console and the customer site: nothing below 12px or 44px,
  wide tables become cards on a phone, section nav is a dropdown below lg
- Overview rebuilt around a "needs attention" queue, money owed, the day so far,
  and which riders are carrying parcels
- Legal status transitions enforced server-side, with an owner-only override that
  requires a written reason and is recorded as an override in status_history
- Riders are released before assignment in the same automation pass, so a courier
  who finishes a drop can be given the next job immediately
- Notification outbox: five trigger points queued and deduplicated, not yet sent
- Rebranded to GO DISPATCH: red palette from the flyer, contact details in one
  file, GD- tracking codes, thirteen destination towns
- Repriced by weight — GHS 50 to 3kg, GHS 10 per extra kilo rounded up — with
  one shared implementation the form quotes from and the server charges by
- Demo staff accounts deleted and the order ledger wiped clean
- Console split into its own bundle at `ADMIN_PATH` (default `/ops`): customers no
  longer download it, and /admin and /admin.html are refused
- The exposed `admin@waypoint.com` owner deleted: old brand, transcript password
  and 61 live sessions retired in one step, audit trail kept its attribution
- Undo on the delivery workflow: one step, ten minutes, side effects reversed with it
- Terms and tracking pages rebuilt; tooltips and a payments search in the console
- Reports lifted onto `feature-reports-pack` to be sold later as an upgrade
- SMS decided and built: six events, one billed segment each, Arkesel wired but
  switched off — see docs/sms-messages.md
- `.env.example` written, and `npm run admin` for staff accounts from a terminal
