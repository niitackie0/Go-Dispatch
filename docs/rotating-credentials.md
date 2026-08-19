# Rotating the credentials

Both of these were pasted into a chat, so both are in a transcript somewhere and
should be replaced. Neither takes more than a few minutes, and each one has a
command that tells you whether it worked.

Do them one at a time, and verify each before starting the next. If both are
wrong at once you cannot tell which one broke.

---

## 1. The Neon database password

This is the one that matters most: it opens every customer record, every
payment and every staff password hash in the system.

**Resetting it cuts every existing connection immediately.** The app will throw
database errors from that moment until `.env` is updated and the server is
restarted, so do it when nobody is booking.

1. **Stop the dev server** (`Ctrl+C` in the terminal running `npm run dev`).

2. Open the [Neon Console](https://console.neon.tech) and pick this project.

3. Find the **Roles** page — it sits under your branch (`production` or `main`,
   whichever this project uses). The role is **`neondb_owner`**.

4. On that role, open its **⋯** menu and choose **Reset password**.

5. Neon shows the new password **once**. Copy it now. It also offers the full
   connection strings; take both, using the dropdown to switch between them:

   - **Pooled** — the host contains `-pooler`. This is `DATABASE_URL`.
   - **Direct** — same host without `-pooler`. This is `DIRECT_URL`.

   If you only copied the password, you can edit the two existing lines in
   `.env` instead: the password is the part between `:` and `@`.

   ```
   postgresql://neondb_owner:THIS_PART@ep-something-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full
   ```

6. Update **both** lines in `.env`. They share the same password and differ only
   in the host. Getting this wrong is the usual mistake: the app works and
   `prisma migrate` fails, or the reverse.

7. Restart and check:

   ```sh
   npm run admin list
   ```

   It reads the database on the pooled connection, so it prints your staff
   accounts if the password is right and fails loudly if it is not.

8. Check the direct connection too, since migrations use a different string:

   ```sh
   npx prisma migrate status
   ```

   "Database schema is up to date" means `DIRECT_URL` is good.

Then `npm run dev` again.

---

## 2. The Arkesel API key

Lower stakes — the worst somebody can do with it is spend your SMS credits —
but it is also a two-minute job.

1. Sign in to the [Arkesel dashboard](https://sms.arkesel.com).

2. Find **API keys** (under the developer or API settings section) and generate
   a new one. If Arkesel only allows a single key, regenerating replaces the old
   one, which is what you want: the old key stops working.

3. Put it in `.env`:

   ```
   SMS_API_KEY=the-new-key
   ```

4. Check it:

   ```sh
   npm run sms:check
   ```

   This asks the provider for your balance. It sends no messages and costs
   nothing, so it is safe to run while sending is still switched off. A working
   key prints your credit balance; a bad one prints what the provider said
   about it.

5. Restart the server if it is running, so it picks up the new value.

---

## While you are in there

Two things worth doing at the same time, both in `.env`:

- **`ADMIN_PATH`** is where the console is served. It defaults to `/ops`.
  Changing it to something less guessable costs nothing and takes effect on
  restart. The console is protected by a password, not by its address, but
  there is no reason to leave a login form where a scanner will find it.

- **`SMS_PROVIDER`** is still empty, which is what keeps sending off. Before you
  set it to `arkesel`, run `npm run sms:outbox` — there are test messages queued
  against real numbers from before sending existed, and they will all go out the
  moment the worker starts.

---

## Afterwards

Nothing in the repository holds either credential — `.env` is gitignored and
`.env.example` has only placeholders. The old values remain in the chat
transcripts they were pasted into, which is exactly why they were replaced;
once rotated, what is in those transcripts is worthless.
