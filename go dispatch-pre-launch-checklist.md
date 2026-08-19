# GO DISPATCH — Pre-Launch Checklist

Courier booking platform: customer booking site + admin console.
Stack: Node/Express on Render (free instance, Frankfurt), Postgres on Neon (London).

Live at **https://go-dispatch.onrender.com** — console at `/ops`.

**The four that cause unrecoverable damage if skipped:** unguessable tracking IDs
(25) ✅, integer pesewas (26) ✅, immutable payment records (27) ✅, tested backup
restore (11) ❌ — **the only one still open, and the largest single risk here.**

Audited against the code on 19 Aug 2026. Items marked *yours* need a dashboard,
a card or a person; nothing in the repo can close them.

---

## 1. Secrets

- [x] 1. All keys in Render environment variables — `.env` is gitignored, `sync: false` in `render.yaml`, no secret in the client bundle
- [x] 2. Git history scanned — no `.env` ever tracked, no real credential in any commit; the pasted Neon and Arkesel credentials were rotated and the old Arkesel key confirmed dead (401)
- [x] 3. Neon connection string never reaches the frontend — server-only import, never in `src/components`
- [ ] 4. Separate credentials for staging and production — **one database, no staging.** Pairs with 34.

## 2. Database (Neon)

- [x] 5. App uses pooled `DATABASE_URL`; `prisma.config.ts` points migrations at direct `DIRECT_URL`
- [ ] 6. **App connects as `neondb_owner`** — the project owner, which can drop the schema it reads. Wants a limited role with DML but no DDL. — **S**
- [ ] 7. Pool size and retry on dropped connections — never configured or tested. `@prisma/adapter-pg` defaults apply. — **S**
- [x] 8. Same-ish region — Render has no UK region; Frankfurt is the nearest to Neon's London. ~10–15ms per query, documented in `docs/deploying.md`
- [x] 9. ~~Scale-to-zero disabled; paid always-on instance~~ — **decided against.** Free instance, sleeps after 15 idle minutes. Accepted knowingly: first request after a quiet spell takes ~1min, and the automation tick only runs while awake.
- [ ] 10. `sslmode` ✅ now `verify-full` in the templates — **but the live values in `.env` and Render still say `require` and need editing by hand.** IP allowlist and spend cap not set. — *yours*
- [~] 11. **Nightly `pg_dump` off Neon, and restore it before keeping it** — built:
      `.github/workflows/backup.yml` dumps, restores into a throwaway Postgres 18,
      counts the rows, fails if no admin account came back, encrypts, keeps 90 days.
      Runs on GitHub because the Render instance sleeps. **Needs two repository
      secrets and one manual run to prove it** — *yours*, see `docs/backups.md`.

> Neon's point-in-time restore is history retention, not an off-site backup. If
> the account lapses, the history goes with it.

## 3. Authentication and access control

- [x] 12. Argon2id via `@node-rs/argon2`
- [–] 13. Session cookie flags — **not applicable.** Auth is a bearer token in `localStorage`, not a cookie. The trade: immune to CSRF, readable by XSS. No `dangerouslySetInnerHTML` anywhere, which is the mitigation that matters.
- [x] 14. Admin and customer auth fully separate; role re-read from the database on every request, so a demotion takes effect immediately
- [x] 15. No endpoint takes an identity from the request body — session ids are scoped to the caller, admin ids come from `req.admin`
- [x] 16. Login rate limited — 10 per 15 min per IP
- [x] 17. Public form abuse — booking limited to 10/hour and tracking to 30/min per IP. No CAPTCHA; the limiter is the guard.

## 4. Input and output

- [x] 18. Prisma everywhere; the only raw SQL is `SELECT 1` in the health check, with nothing interpolated
- [~] 19. Server-side validation on every input — present and thorough, but hand-rolled rather than schema-driven. No zod. Types are not checked, so `senderName: {}` reaches Prisma and 500s. — **S** to harden
- [x] 20. React escapes on render; zero uses of `dangerouslySetInnerHTML`
- [–] 21. File uploads — **not applicable.** No upload surface anywhere in the product.
- [x] 22. Responses trimmed — public tracking hand-builds its payload; `riderToken` was leaking through `serializeOrder` into the public booking lookup and is now admin-only (`4c336e2`)
- [x] 23. Security headers written out in `src/server/security.ts` — HSTS, nosniff, frame-deny, referrer, permissions, CORP. `x-powered-by` off. Render forces HTTPS. **No CSP yet.** — **S**
- [ ] 24. `npm audit` — **5 vulnerabilities (4 high, 1 moderate)** in prod deps: `@prisma/config`/`deepmerge-ts`, `nanoid`, `postcss`. Dependabot not enabled. — **S**

## 5. Courier-specific

- [x] 25. Tracking codes from `crypto.randomInt`, never sequential; tracking endpoint rate-limited
- [x] 26. Money is integer pesewas throughout; `packageWeightKg` is a Decimal converted explicitly
- [x] 27. Payments immutable — `payments.ts` exposes only `GET /`. Undo marks an auto-created payment `failed`, never deletes it
- [ ] 28. **Idempotency key on booking creation** — none. A double-tap creates two deliveries, and a sleeping instance makes the first request slow enough that people *will* tap twice. — **S**
- [x] 29. Server-side state machine in `src/transitions.ts`, shared with the console so it cannot offer an illegal move; owner-only override requires a written reason
- [x] 30. No delete path for orders or payments — cancellation is a status. Staff accounts delete, but `status_history` keeps attribution via `onDelete: SetNull` plus a denormalised name
- [ ] 31. Daily reconciliation view, tested against a fake day's cash — **M**

> The public tracking page is the most exposed surface: unauthenticated, and it
> answers on an exact phone match as well as a code.

## 6. Operations

- [ ] 32. **Error monitoring** — errors go to stdout, and nobody reads stdout. — **M**
- [~] 33. Migrations as a release step — they run at the end of `buildCommand`, because Render's pre-deploy step is paid-only. Safe with one instance; documented in `render.yaml`
- [ ] 34. Staging on its own Neon branch, seeded not copied — **none.** The live table holds real names, phone numbers and home addresses. — **M**
- [x] 35. All timestamps `timestamptz` (23 columns)
- [~] 36. Phone numbers normalised to E.164 — only at *send* time, in `toGhanaMsisdn`. Stored exactly as typed, so `0244…` and `+233244…` are different rows to a tracking search. — **S**
- [x] 37. `GET /api/health` pings the database and 503s if it cannot

## 7. Legal

- [x] 38. Terms and policy pages live at `/policy`
- [ ] 39. Data Protection Commission registration — *yours, and needs someone qualified in Ghana.* The platform stores names, phone numbers and home addresses.

*Not legal advice.*

---

## 8. Verification — test these, don't just implement them

- [–] 40. Customer A fetching customer B's booking — **not applicable.** No customer accounts; a booking reference is the credential.
- [ ] 41. POST a booking with `amount`/`status` in the body → must be ignored
- [ ] 42. `curl` a delivery from "requested" straight to "delivered" → must be rejected
- [ ] 43. Submit the booking form twice rapidly → **currently creates two.** See 28.
- [ ] 44. Idle 15+ minutes, then hit it → measure the real cold start
- [ ] 45. Suspend Neon compute mid-request → clean error, not a hang
- [–] 46. Upload tests — not applicable, see 21.
- [ ] 47. Restore last night's dump into a scratch Neon branch and open the console against it — blocked on 11

## 9. Launch day

- [ ] 48. Staging run-through — blocked on 34
- [ ] 49. Manual backup immediately before the production migration — blocked on 11
- [x] 50. Backend deployed, health check verified, frontend served from the same origin
- [x] 51. Owner account created directly, never a default password — `npm run admin` reads it from the keyboard, masked
- [ ] 52. **Place one real booking and complete it fully before telling anyone the site is live**

## 10. First week

- [ ] 53. Read the error feed daily — blocked on 32
- [ ] 54. Watch Neon's query stats for slow queries seed data hid
- [ ] 55. Confirm dumps are landing — blocked on 11
- [ ] 56. Confirm SMS arrives on real Ghanaian networks — sending is ON; one real booking proves it

## 11. Handover

- [ ] 57. One-page doc: reset a password, mark a payment, correct a mistake, who to call
- [ ] 58. Agree what "supported" means — response times, bug vs feature, what each costs
- [ ] 59. Client owns the domain — **no domain bought yet.** Register it on their account, not yours.
- [ ] 60. Calendar reminder for the first month-end reconciliation

---

## Where this leaves us

**Done: 24. Not applicable: 5. Partial: 4. Outstanding: 27** — but most of the
outstanding are launch-day and first-week items that cannot be done yet.

The real queue, in order:

1. **11 — backups.** The last of the four unrecoverable ones.
2. **28 — idempotency on booking.** Cheap, and a sleeping instance makes it likely.
3. **6 — a limited database role.** The app can currently drop its own schema.
4. **24 — npm audit.** Four highs.
5. **52 — one real booking, end to end.** Proves the SMS chain on a real network.
