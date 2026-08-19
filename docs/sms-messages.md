# SMS — what we send, and what makes it send

Every text GO DISPATCH sends, what triggers it, and who receives it.

Two audiences for this page: whoever signs off the wording, and whoever has to
work out why a customer says they got no message. The exact text lives in
`src/server/notifications.ts` — this describes it, and
`npm run sms:preview` prints it.

---

## How sending works at all

Nothing is sent at the moment it happens. When something happens that earns a
text, a row is written to the `notifications` table **inside the same database
transaction** as the change that caused it, and a worker sends it later.

That indirection buys two things worth keeping:

- **A provider outage can never fail a customer's booking.** The booking and
  its message land together or not at all; delivery is a separate problem.
- **The wording is fixed when the event happens.** Editing a template later
  cannot rewrite what a customer was already told.

The worker (`src/server/outbox.ts`) wakes every 30 seconds, sends what is due,
and retries failures after 1 minute, 5 minutes, 30 minutes and 2 hours before
giving up. Errors that retrying cannot fix — an unregistered sender ID, a
number that is not a Ghanaian mobile — fail immediately instead of burning five
attempts to learn the same thing.

**Sending is off until `SMS_PROVIDER=arkesel` is set in `.env`.**

---

## The six messages

| # | Message | Goes to | Fires when |
|---|---------|---------|------------|
| 1 | Booking confirmed | Sender | A booking is accepted, or a prepaid one is paid for |
| 2 | Price confirmed | Sender | Weighing the parcel **changed** the price |
| 3 | Rider assigned | Sender | Automation gives the job to a courier |
| 4 | Out for delivery | **Recipient** | The parcel moves to *in transit* |
| 5 | Delivered | Sender | The parcel is marked *delivered* |
| 6 | Cancelled | Sender | The order is cancelled |

A typical pay-on-delivery parcel therefore produces **four** texts: three to the
sender (booked, rider coming, delivered) and one to the recipient (arriving
today). At roughly 1 credit each, 466 credits is about 115 deliveries.

---

## 1. Booking confirmed → the sender

The receipt. It carries the code everything else is tracked with, so it is the
one message that must never fail to arrive.

**Fires from three places:**

| Path | What happens |
|------|--------------|
| `POST /api/orders/book` with pay-on-delivery | The order is created already `confirmed`, and this sends immediately. |
| `POST /api/orders/book` with prepaid | **Nothing sends yet.** The order waits in `awaiting_payment`. When the payment lands — an admin recording it with `POST /api/orders/:id/pay`, or the automation pass seeing it — the order is auto-confirmed and *this* is what sends. |
| `POST /api/bookings` (several parcels at once) | **One message for the whole visit**, carrying the booking reference rather than one text per tracking code. |

It also fires if an admin moves an order into `confirmed` by hand from the
dispatch board.

> **Dear Henry, your parcel is booked. Code GD-4821-330. Payment is due on delivery. Track it with that code or call 054 030 4994.**

Paid up front:

> **Dear Henry, payment received and your parcel is booked. Code GD-4821-330. Track it with that code or call 054 030 4994.**

Prepaid, payment not in yet — sent only if an admin confirms such an order by
hand, which is a decision to collect before being paid:

> **Dear Henry, your parcel is booked. Code GD-4821-330. We collect once your payment lands. Call 054 030 4994 if you need a hand.**

Several parcels in one booking:

> **Dear Henry, your 3 parcels are booked. Reference GDB-4821-330 tracks them all. Prices confirm when we weigh each one. Call 054 030 4994.**

---

## 2. Price confirmed → the sender

The terms page promises that if a parcel weighs more than declared we will get
in touch *before* dispatching it, rather than charging the difference quietly.
This message is that promise.

**Fires when:** staff record the scale weight —
`PATCH /api/bookings/parcels/:id/weight` — **and the new price differs from the
estimate**. If the price is unchanged, nothing sends: "your price is the same"
is a text nobody needs and everybody pays for.

> **Dear Henry, GD-4821-330 weighed 4.2kg. The price is GHS 60.00, not the GHS 50.00 estimated. Call 054 030 4994.**

---

## 3. Rider assigned → the sender

So that an unknown number calling at the gate is expected, and so the sender has
somebody to ring if the rider is late.

**Fires when:** the automation pass assigns a courier — the parcel is
`confirmed`, its collection window is within the hour, and a rider is free.
Riders are freed as soon as they finish, so this can happen at any tick.

Not sent when an admin queues an order by hand, because only the automation pass
knows which rider took it.

> **Dear Henry, Kwesi is on the way to collect GD-4821-330. He will call when he arrives. His number is 0244123456.**

Without a number on file for the rider:

> **Dear Henry, Kwesi is on the way to collect GD-4821-330. He will call you when he arrives.**

---

## 4. Out for delivery → **the recipient**

The only message that goes to somebody who never dealt with us, so it names the
sender and identifies us. It is also the only one that tells anybody to have
money ready.

**Fires when:** the parcel moves to `in_transit`, from either
`PATCH /api/orders/:id/status` (an admin advancing it) or
`POST /api/rider/:token/status` (the courier's own link).

The sender does **not** get this one. They care that it arrived, which is
message 5.

Recipient is paying at the door:

> **Dear Ama, a parcel from Henry reaches you today. Code GD-4821-330. Have GHS 60.00 ready for the rider. Call 054 030 4994.**

Already paid for:

> **Dear Ama, a parcel from Henry reaches you today. Code GD-4821-330. The rider will call you. Call 054 030 4994.**

---

## 5. Delivered → the sender

The outcome they paid for, and confirmation of any cash taken at the door.

**Fires when:** the parcel moves to `delivered`, from either the dispatch board
or the courier's link.

Not sent to the recipient — they are standing in front of the rider.

Cash collected on delivery:

> **Dear Henry, GD-4821-330 was delivered to Ama. GHS 60.00 was collected. Thank you.**

Prepaid:

> **Dear Henry, GD-4821-330 was delivered to Ama. Thank you for choosing us.**

---

## 6. Cancelled → the sender

Silence here was the worst gap in the system: a parcel that is simply never
collected, and nobody told.

**Fires when:** an order moves to `cancelled`. Only staff can cancel — a
courier's link cannot.

Nothing had been paid:

> **Dear Henry, GD-4821-330 has been cancelled and you have not been charged. Call 054 030 4994 if this is a mistake.**

Already paid for:

> **Dear Henry, GD-4821-330 has been cancelled. We will call you about your refund. Any questions, call 054 030 4994.**

---

## What is deliberately not sent

| Not sent | Why |
|----------|-----|
| A separate "payment received" | The same automation pass sees the payment and confirms the booking, so this arrived in the same second as the confirmation, saying half of one sentence, and was billed twice. Message 1 now mentions the payment when there was one. |
| "Delivered" to the recipient | They are standing in front of the rider. |
| "Out for delivery" to the sender | They want to know it arrived, not that it left. |
| One confirmation per parcel in a multi-parcel booking | Four parcels used to mean four texts in the same second with four different codes. Now one, with the reference. |
| Cash-collected receipts from the rider's link | Message 5 already reports what was collected. |
| A "reply STOP" footer | These are transactional messages about a parcel somebody actually sent, not marketing. The footer would cost ~25 characters on every message forever. |

---

## Rules every message obeys

**One billed segment.** An SMS is 160 characters only while every character is
in the GSM-7 alphabet. A single curly apostrophe pasted from a document drops
the limit to 70 and can turn one message into three. So text is sanitised into
GSM-7 before it is queued — quotes straightened, dashes flattened, out-of-
alphabet accents folded — and segments are measured, not assumed.
`npm run sms:preview` prints every variant with its cost and flags any with
under 20 characters of headroom.

**Nobody is texted twice.** The `(orderId, event)` unique constraint means a
second attempt to queue the same event for the same order is discarded. This is
what makes it safe for the automation pass, which re-reads the same orders every
60 seconds.

**Undo takes the message back.** Undoing a status change deletes its queued
message if it has not gone yet, so nobody is told about a delivery that was
reversed two seconds later. Once a message has been *sent* it stays on the
record — the honest repair for that is the next message, not a quiet delete.

**Names are addressed, but never at double the price.** Messages open "Dear
Henry," using the sender's name, or the recipient's on message 4. If somebody
types a company name into the name field and the greeting is what tips the
message into a second segment, the greeting is dropped rather than the cost
doubled.

**Bad numbers are refused, not queued.** Phone numbers are normalised to
Ghanaian E.164 (`0554431300` → `233554431300`) when the row is written. A number
that cannot be one — a landline, a foreign number, a typo — gets no row at all,
and a warning in the log.

---

## Running it

```sh
npm run sms:preview          # every message, with its length and cost
npm run sms:outbox           # what is queued, sent and failed. Sends nothing
npm run sms:outbox -- --send # actually send the queue
```

**Provider:** Arkesel. The API key is in `.env` as `SMS_API_KEY`; the balance is
visible in `npm run sms:outbox` once sending is on.

**Before switching on:**

1. Clear the stale queue. Confirmations from test bookings are still pending
   against real numbers and would all send the moment the worker starts.
   `npm run sms:outbox` lists them.
2. Register the sender ID **GO DISPATCH** with Arkesel — 11 characters, which is
   the GSM maximum. Until it is approved, messages arrive from a shortcode and
   every template carries a 13-character `GO DISPATCH: ` prefix to say who it is
   from. Once approved, set `SMS_SENDER_ID_REGISTERED = true` in `src/brand.ts`
   and every message gets those characters back.
3. Set `SMS_PROVIDER=arkesel` in `.env`. That is the switch.

## Where the code is

| File | What it holds |
|------|---------------|
| `src/server/notifications.ts` | Which events earn a message, who each goes to, and the wording |
| `src/server/sms.ts` | GSM-7 sanitising, segment counting, Ghanaian number normalising |
| `src/server/smsProvider.ts` | The only file that talks to Arkesel |
| `src/server/outbox.ts` | The worker: batching, retries, giving up |
| `src/server/automations.ts` | Triggers messages 1 and 3 |
| `src/server/routes/orders.ts` | Triggers messages 1, 4, 5 and 6 by status change |
| `src/server/routes/bookings.ts` | Triggers message 1 for a whole booking, and message 2 at weigh-in |
| `src/server/routes/rider.ts` | Triggers messages 4 and 5 from the courier's link |
