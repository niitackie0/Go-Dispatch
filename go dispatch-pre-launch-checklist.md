# Waypoint — Pre-Launch Checklist

Courier booking platform: customer booking site + admin dashboard.
Stack: Node backend on Render, Postgres on Neon.

**The four that cause unrecoverable damage if skipped:** unguessable tracking IDs (25), integer pesewas (26), immutable payment records (27), tested backup restore (11). Everything else can be fixed after launch.

---

## 1. Secrets

- [ ] 1. All keys in Render environment variables — nothing in the repo, nothing in the client bundle
- [ ] 2. Scan git history for leaked secrets (`gitleaks detect`) and rotate anything that ever landed there
- [ ] 3. Neon connection string never reaches the frontend
- [ ] 4. Separate credentials for staging and production

## 2. Database (Neon)

- [ ] 5. App uses the pooled endpoint (`-pooler` host); migrations use the direct endpoint
- [ ] 6. App connects as a limited role, not the project owner
- [ ] 7. Pool max ~10 per instance; retry logic for dropped connections
- [ ] 8. Neon project and Render service in the same region (Frankfurt is usually best for Ghana)
- [ ] 9. Scale-to-zero disabled; Render on a paid always-on instance
- [ ] 10. IP allowlist enabled, `sslmode=require`, autoscaling spend cap set
- [ ] 11. Nightly `pg_dump` to R2/S3 — **and restore it once before launch**

> Neon's point-in-time restore is history retention, not an off-site backup. If the account lapses, the history goes with it.

## 3. Authentication and access control

- [ ] 12. Passwords hashed with bcrypt or argon2
- [ ] 13. Session cookies set `httpOnly`, `secure`, `sameSite`
- [ ] 14. Admin and customer auth fully separate; role re-checked server-side on every admin route
- [ ] 15. Every query filters by the authenticated user's ID — never trust an ID from the request body
- [ ] 16. Rate limit login and password reset
- [ ] 17. Bot protection on the public booking form

## 4. Input and output

- [ ] 18. Parameterized queries everywhere — verify any raw SQL your ORM doesn't cover
- [ ] 19. All input validated server-side against a schema (zod or similar)
- [ ] 20. User content escaped on render; no `dangerouslySetInnerHTML`
- [ ] 21. File uploads limited by type, size, and count; stored in R2/S3, not Render's ephemeral disk
- [ ] 22. API responses return only needed fields — no password hashes, no internal notes, no other customers' data
- [ ] 23. Security headers (helmet) and HTTPS forced with HSTS
- [ ] 24. `npm audit` clean; Dependabot enabled

## 5. Courier-specific

- [ ] 25. Tracking IDs random and unguessable (nanoid/ULID); tracking endpoint rate-limited
- [ ] 26. Money stored as integers in pesewas, never floats
- [ ] 27. Payment records immutable — corrections are new rows recording who, when, and how; never silent edits
- [ ] 28. Idempotency key on booking creation so a double-tap doesn't create two deliveries
- [ ] 29. Delivery status enforced as a server-side state machine (in line → called → picked up → delivered)
- [ ] 30. Soft deletes only, with an audit log of every admin change
- [ ] 31. Daily reconciliation view built and tested against a fake day's cash

> A public tracking page is your most exposed surface: unauthenticated, and enumerable if the IDs are sequential.

## 6. Operations

- [ ] 32. Sentry wired up; uptime monitor alerting to your phone
- [ ] 33. Migrations run as a Render release command, not on app boot
- [ ] 34. Staging on its own Neon branch — seeded or anonymized, not a copy of real customer addresses
- [ ] 35. All timestamps stored in UTC
- [ ] 36. Phone numbers normalized to +233 E.164 on input
- [ ] 37. Health check endpoint that actually pings the database

## 7. Legal

- [ ] 38. Terms and privacy policy live before the first real booking
- [ ] 39. Client confirms Data Protection Commission registration — the platform stores names, phone numbers, and home addresses

*Not legal advice — this needs to be on the client's radar, verified with someone qualified in Ghana.*

---

## 8. Verification — test these, don't just implement them

- [ ] 40. Log in as customer A, take customer B's booking ID, try to fetch it → should 403/404
- [ ] 41. Send a booking request with `amount` and `status` in the body → server ignores them
- [ ] 42. Move a delivery from "in line" straight to "delivered" via curl → rejected
- [ ] 43. Submit the booking form twice rapidly → one delivery created
- [ ] 44. Leave the app idle 30 minutes, then hit it → measure the real cold-start time
- [ ] 45. Suspend the Neon compute mid-request → clean error, not a hang
- [ ] 46. Upload a 200MB file, and a `.php` renamed to `.jpg` → both rejected
- [ ] 47. Restore last night's dump into a scratch Neon branch and open the admin dashboard against it

## 9. Launch day

- [ ] 48. Deploy to staging with production-shaped data; run booking → payment → delivery end to end
- [ ] 49. Take a manual backup immediately before the production migration
- [ ] 50. Deploy backend, verify health check, then point the frontend
- [ ] 51. Create the client's admin account yourself — never ship a default password
- [ ] 52. **Place one real booking and complete it fully before telling anyone the site is live**

## 10. First week

- [ ] 53. Read the Sentry feed daily — the first week's errors are the real spec
- [ ] 54. Watch Neon's query stats for slow queries that seed data hid
- [ ] 55. Confirm dumps are actually landing in the bucket (a silently failing cron is the classic)
- [ ] 56. Confirm SMS/email confirmations arrive on real Ghanaian networks, not just your inbox

## 11. Handover

- [ ] 57. One-page doc: how to reset a password, mark a payment, correct a mistake, who to call when it's down
- [ ] 58. Agree what "supported" means — response times, bug vs. new feature, what each costs
- [ ] 59. Client owns the domain; Neon and Render billing sits on their card, or explicitly on yours with an invoice trail
- [ ] 60. Calendar reminder for the first month-end reconciliation — sit with them the first time they close the books
