# Deploying GO DISPATCH to Render

One web service. The same Express process serves the API, the customer site and
the console, so there is no second service, no CORS, and no separate frontend
host to keep in step.

The database stays on Neon. It is already provisioned and holds the live
orders — do not let a Render blueprint create a Postgres alongside it.

`render.yaml` in the repo root is the blueprint. Everything below is either a
thing you do once in a browser, or a thing to check afterwards.

---

## 0. Before anything: bring `main` up to date

`main` is still the initial commit. `dev` is 59 ahead of it. Render deploys the
branch named in the blueprint, so deploying today would ship the scaffolding
this product was built out of.

```bash
git push origin dev                # 47 commits are still only on your machine
git checkout staging && git merge dev && git push origin staging
git checkout main    && git merge staging && git push origin main
git checkout dev
```

Nothing else in this document works until that is done.

---

## 1. Create the service

Render Dashboard → **New** → **Blueprint** → pick this repository.

Render reads `render.yaml` and proposes one web service, `go-dispatch`, on the
**free** instance type in **Frankfurt**.

**The free instance, deliberately.** It sleeps after 15 minutes with no
traffic and takes about a minute to wake. For an operation this size that is
the right trade — the machine has no business running at 3am — but two
consequences are worth knowing rather than discovering.

**The first request after a quiet spell is slow.** Roughly a minute. In
practice this is the first booking of the morning, and whoever opens the
console before the day starts absorbs it on everyone's behalf.

**The automation rules only run while the service is awake.** `server.ts` runs
them on a 60-second interval inside the web process: auto-queueing a parcel
when its pickup window opens, releasing a courier who has finished, reconciling
an on-delivery payment. While the service sleeps, none of that happens; it all
runs in the first tick after someone wakes it.

This matters less than it sounds. Every rule also runs immediately after any
booking, status change or payment — the interval exists only for transitions
that are purely about the clock. So the real effect is that a parcel booked at
1am is not auto-queued at 1am; it is auto-queued when the office opens. For a
courier that does not drive at night, that is what should happen anyway.

Where it would bite is a pickup window that opens before anyone signs in. If
that ever becomes real, the fix is not a bigger instance — it is to stop
relying on the tick for that rule, and run it when the board is read.

**Frankfurt**, because Render has five regions — Oregon, Ohio, Virginia,
Frankfurt, Singapore — and none of them is London. The Neon project *is* in
London, so the app and its database cannot be co-located.

That is fine, and worth understanding rather than worrying about. The distance
that dominates is Accra to Europe, roughly 5,000km either way; London to
Frankfurt adds something like 10–15ms per query on top. A page issuing four
sequential queries pays it four times, so keep an eye on N+1 queries — the hop
turns a sloppy loop into a visible delay much sooner than a co-located database
would.

If you ever want them in the same place, Neon cannot move a project between
regions: it means a new project in Frankfurt and a dump/restore into it. The
cheapest moment for that is while the database still holds two accounts and a
handful of test orders. It gets expensive the day it holds a month of real
deliveries.

---

## 2. Fill in the secrets

Render prompts for every variable marked `sync: false`. They are never written
to the repo.

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Neon → Connection string → **Pooled**. Host ends in `-pooler`. |
| `DIRECT_URL` | The same string with `-pooler` removed from the host. |
| `ADMIN_PATH` | Where the console lives. Keep whatever `.env` uses — `/ops`. |
| `SMS_PROVIDER` | **Leave empty for the first deploy.** See step 5. |
| `SMS_API_KEY` | Arkesel dashboard. The rolled key, not the one from August. |

`NODE_ENV=production` and `TRUST_PROXY=1` are already in the blueprint.

`TRUST_PROXY` matters more than it looks. Render terminates TLS one hop in
front of the app, so `req.ip` is the proxy's address unless Express is told
how many hops to look back — and every rate limit in the product is keyed on
`req.ip`. Get it wrong in one direction and all visitors share one bucket, so
the first person to fumble a password locks out everyone else. Wrong in the
other and a client can write its own `X-Forwarded-For` and walk past every
limit in the file. `1` is correct for Render.

---

## 3. What the deploy actually runs

```
build       npm ci && npm run build      # prisma generate, vite build, esbuild
pre-deploy  npm run release              # prisma migrate deploy
start       npm start                    # node dist/server.cjs
health      GET /api/health
```

Migrations run in the **pre-deploy** step, once per deploy, before the new
instance takes traffic. Never on boot: every restart would race them, and two
instances booting together would race each other for the advisory lock.

`prisma generate` runs during the build and reads `DIRECT_URL` through
`prisma.config.ts` — so a missing value fails the build rather than the deploy,
which is the better place to find out.

The health check answers only if Postgres answers. A health check that returns
200 while the database is unreachable keeps a broken instance in the load
balancer and tells the uptime monitor everything is fine.

---

## 4. After the first deploy

```bash
curl -i https://<your-service>.onrender.com/api/health
```

Expect `{"ok":true}` and these headers: `strict-transport-security`,
`x-content-type-options`, `x-frame-options`, `referrer-policy`.

Then check, in a browser:

- `/` — the customer site loads and a quote is calculated
- `/ops` — the console's sign-in appears
- `/admin` and `/admin.html` — **both must 404**
- Sign in, open the dispatch board, open one order

There is no admin account to create: `annanrichard26@gmail.com` already exists
in this database and the password is the one you set. If it is ever lost,
`npm run admin password <email>` still works from a terminal without being
signed in.

---

## 5. The custom domain

`godispatchgh.com`, registered on Porkbun. Two dashboards, in this order.

**Render** — Settings → Custom Domains → Add Custom Domain. Type the apex and
nothing else:

```
godispatchgh.com
```

No `www.`, no `https://`, no trailing slash, whatever the placeholder in the
field suggests. Render then shows the DNS records to create — read them off
that screen rather than copying an IP out of a document like this one, which
goes stale the day Render renumbers.

Apex rather than `www` for a reason that is not aesthetic: the address is
inside every SMS carrying a tracking link, so `www.` would cost four characters
of every message, on every order, forever. The move from
`go-dispatch.onrender.com` to `godispatchgh.com` was worth eight characters in
the other direction — see `src/brand.ts`.

**Porkbun** — DNS → add exactly what Render displayed. Porkbun supports `ALIAS`
at the apex; take it over a bare `A` record if Render offers both, because an
`ALIAS` follows Render's hostname and survives them changing the address behind
it. Then wait: verification is usually minutes, the TLS certificate a little
longer, and neither is worth debugging in the first quarter of an hour.

**Then the code.** `PUBLIC_ORIGIN` in `src/brand.ts` is a literal, not an
environment variable — it is a business detail like the phone number, and it is
bundled into the browser where `process.env` does not exist. It is already set
to the new domain, so this is only a note for the next time it moves.

**The old address keeps answering, and that is the trap.** Adding a custom
domain does not retire `go-dispatch.onrender.com`; both serve the same site on
the same certificate, which is two live copies of one shop. `canonicalHost` in
`src/server/security.ts` 301s the onrender host to `PUBLIC_ORIGIN` so there is
one address. Two things about it are load-bearing:

- It exempts `/api/health`. Render polls that path on the onrender host to
  decide whether the instance is alive, and a 301 is not a 200 — redirecting it
  marks a healthy service unhealthy and rolls the deploy back.
- It redirects away from `.onrender.com` only, never from "any host that is not
  canonical". The tidier-sounding version bounces Render's internal probes and
  anything else unforeseen.

Check both after the certificate is live:

```bash
curl -i https://godispatchgh.com/api/health
curl -sI https://go-dispatch.onrender.com/ | head -3
curl -sI https://go-dispatch.onrender.com/api/health | head -3
```

Expect `{"ok":true}` from the first, a `301` to `https://godispatchgh.com/`
from the second, and a plain `200` — **not** a redirect — from the third.

---

## 6. Turning SMS on — deliberately, and second

Deploy once with `SMS_PROVIDER` empty. Messages queue in the outbox and nothing
is sent, so a mistake in step 1 costs nothing but a redeploy.

When the service is up and you have placed one real booking end to end:

1. `npm run sms:outbox` — read what is queued. It drains the moment you switch
   sending on, to real phones.
2. Register the sender ID **GO DISPATCH** with Arkesel. Until it is approved,
   messages arrive from a shortcode and every template carries a 13-character
   `GO DISPATCH: ` prefix to say who it is from. Once approved, flip
   `SMS_SENDER_ID_REGISTERED` in `src/brand.ts` and every message gets those
   characters back.
3. Set `SMS_PROVIDER=arkesel` in Render and redeploy.

---

## 7. Still outstanding after this

Deployment is not launch. From the pre-launch checklist, these remain and none
of them are Render settings:

- **Off-site backups.** Neon's point-in-time restore is history retention, not
  a backup — if the account lapses, the history goes with it. A nightly
  `pg_dump` to object storage, and a restore actually tested once.
- **A limited database role.** The app connects as `neondb_owner`, which can
  drop the schema it reads.
- **Error monitoring.** Errors go to stdout, and after this deploy nobody is
  reading stdout.
- **Staging on its own Neon branch**, seeded rather than copied — the live
  table holds real names, phone numbers and home addresses.
- **The automation tick.** It runs on an interval inside the web process. On a
  single always-on instance that is correct. The day there are two instances,
  both will run it.
