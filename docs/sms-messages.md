# SMS — what we send, and what makes it send

Every text GO DISPATCH sends, what triggers it, and who receives it.

Two audiences for this page: whoever signs off the wording, and whoever has to
work out why a customer says they got no message. The exact text lives in
`src/server/notifications.ts` — this describes it, and
`npm run sms:preview` prints it.

For the wording alone, in template form with the placeholders left in, see
[`sms-templates.md`](sms-templates.md).

---

## The job these messages describe

GO DISPATCH is **not** door-to-door delivery, and the messages only make sense
against what actually happens:

1. Somebody books a parcel.
2. A rider is assigned to **collect** it from them.
3. The rider brings it **to the office**.
4. It is **weighed**. The price is fixed and the bill goes out.
5. It is **paid** by MoMo. Nothing moves before this.
6. A rider runs it to the **station** and hands it to an intercity **bus**.
7. The **car number** is texted to both ends. **That is the end of our job.**

The recipient collecting from the bus is not something we can see, so there is
no message about it. A text claiming a parcel was delivered would be a guess.

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

**Sending is live.** `SMS_PROVIDER` is set to Arkesel and the **GO DISPATCH**
sender ID is registered, so messages arrive from the brand name and carry no
prefix in the body. Clearing `SMS_PROVIDER` in `.env` is the off switch: the
outbox keeps queuing and nothing goes out.

---

## The six messages

| # | Message | Goes to | Fires when |
|---|---------|---------|------------|
| 1 | Request received, rider coming | Sender | Automation gives the **collection** to a courier |
| 2 | Booking confirmed | Sender | **Several parcels** booked in one visit |
| 3 | Payment request | **Whoever pays** | The parcel is weighed at the office |
| 4 | On the bus → sender | Sender | The car number is recorded |
| 5 | On the bus → recipient | **Recipient** | The same moment |
| 6 | Cancelled | Sender | The order is cancelled |

A single parcel produces **four** texts: three to the sender (rider coming, the
bill, on the bus) and one to the recipient (car number). Message 2 only appears
when somebody sends several parcels at once.

---

## 1. Request received, rider coming → the sender

The receipt **and** the collection notice, in one message. It carries the code
everything else is tracked with, so it is the one message that must never fail
to arrive.

These used to be two texts. The first went out at booking and said "we have your
parcel" — which was not true, the parcel was still in the customer's hands — and
it carried the same tracking code the second one carried less than an hour
later. They were merged into the one moment where there is something to say.

**Fires when** the automation pass assigns a courier to the **collection** — the
parcel is `confirmed`, its collection window is within the hour, and a rider is
free.

> **Dear Henry**
> **We have your request. Kwesi is collecting it, on 0244123456**
>
> **Use GD-4821-330 to track here go-dispatch.onrender.com/t/GD-4821-330**

No number on file for the rider:

> **Dear Henry**
> **We have your request. Kwesi is collecting it and will call on arrival**
>
> **Use GD-4821-330 to track here go-dispatch.onrender.com/t/GD-4821-330**

**What the merge costs.** A parcel booked for tomorrow is now silent until about
an hour before collection, and a parcel the fleet is too busy to assign is
silent until somebody frees up. The booking screen shows the tracking code, so
nobody is left without it — but if that silence ever produces phone calls, this
is the reason.

**This is the tightest message in the set**, 10 to 20 characters spare depending
on the names. It carries a greeting, a rider, a phone number, a code and a URL;
the link alone is 38 characters. Run `npm run sms:preview` before changing a
word of it.

The **station run** deliberately sends nothing. Nobody needs a text saying a
parcel crossed the office yard, and the car number is what actually matters.

---

## 2. Booking confirmed → the sender (several parcels only)

One text for a whole visit, carrying the reference that finds every parcel in
it, rather than one text per tracking code all in the same second.

**Fires when** a booking of **more than one** parcel is accepted. A single
parcel gets nothing here — message 1 covers it.

> **Dear Henry**
> **We have your 3 parcels. Prices confirm when we weigh each one. Use GDB-4821-330 to track them here: go-dispatch.onrender.com/t/GDB-4821-330**

---

## 3. Payment request → whoever is paying

The bill, and the only message that asks for anything. It goes to the person the
`payer` column names, which may be the **recipient** — somebody who never dealt
with us — so that variant says who the parcel is from.

**Fires when** staff record the scale weight —
`PATCH /api/bookings/parcels/:id/weight`. **Every time**, not only when the price
changed: this is the invoice, and a parcel that is weighed and never billed sits
on a shelf while everyone waits for the other to move.

No tracking link on this one. The action is a MoMo transfer, and 38 characters
of URL would buy nothing the number and the code do not already give.

Weighing changed the price:

> **Dear Henry**
> **GD-4821-330 weighed 4.2kg, so the price is GHS 60.00, not GHS 50.00. Pay by MoMo to 054 030 4994 and it goes on the bus.**

The estimate was right:

> **Dear Henry**
> **GD-4821-330 weighed 4.2kg. Pay GHS 60.00 by MoMo to 054 030 4994 and it goes on the bus.**

The recipient is paying:

> **Dear Ama**
> **Henry has sent you a parcel, GD-4821-330. It weighed 4.2kg. Pay GHS 60.00 by MoMo to 054 030 4994 and it goes on the bus.**

---

## 4 and 5. On the bus → **both ends**

The car number, and the reason this is the one event that texts two people. Once
the parcel is on a bus that number is the only handle either of them has on it.

**Fires when** an admin records the bus — `POST /api/orders/:id/dispatch`. Both
messages are queued in the same transaction as the status change, because a
dispatch recorded without them going out is a parcel nobody can find.

**Refused unless the parcel is paid for.** Past the station there is nothing we
can do to collect and nobody of ours at the far end to do it.

To the sender — named by where it is *going*:

> **Dear Henry**
> **Your parcel to Ama is on GT 4821 24**
>
> **Use GD-4821-330 to track here go-dispatch.onrender.com/t/GD-4821-330**

To the recipient — named by where it is *from*, because otherwise this is a text
from a company they have never heard of:

> **Dear Ama**
> **Your parcel from Henry is on GT 4821 24**
>
> **Use GD-4821-330 to track here go-dispatch.onrender.com/t/GD-4821-330**

**Two events for one message.** The `(orderId, event)` unique constraint — the
thing that stops the automation texting twice — means one event can only ever
reach one person. So these are `dispatched_sender` and `dispatched_recipient`,
two differently-worded messages, rather than one event bent to serve two
audiences.

---

## 6. Cancelled → the sender

Silence here was the worst gap in the system: a parcel that is simply never
collected, and nobody told.

**Fires when** an order moves to `cancelled`. Only staff can cancel, except by
the sender from the tracking page before a courier has been sent.

> **Dear Henry**
> **GD-4821-330 has been cancelled and you have not been charged. Call 054 030 4994 if this is a mistake.**

Already paid for:

> **Dear Henry**
> **GD-4821-330 has been cancelled. We will call you about your refund. Call 054 030 4994.**

---

## What is deliberately not sent

| Not sent | Why |
|----------|-----|
| A separate booking confirmation for one parcel | It said "we have your parcel" when the parcel was still with the customer, and repeated a tracking code the collection notice carried an hour later. Folded into message 1. |
| Anything after the bus | Our job ends at the station. We cannot see the far end, so we cannot honestly say a parcel was collected — and a message that guesses is worse than no message. |
| A "payment received" receipt | The dispatch message follows it and is itself the proof the money landed. |
| A text when the station run is assigned | Nobody needs to know a parcel crossed the office yard. |
| One confirmation per parcel in a multi-parcel booking | Four parcels used to mean four texts in the same second with four different codes. Now one, with the reference. |
| A "reply STOP" footer | These are transactional messages about a parcel somebody actually sent, not marketing. The footer would cost ~25 characters on every message forever. |

**Retired with the door-delivery model**: `price_confirmed` (became the bill),
`out_for_delivery` and `delivered` (nobody is bringing it to a door), and
`payment_received`. They still render, because rows written under that model
record what customers were actually told and must read back as they were sent.

---

## Rules every message obeys

**One skeleton.** Every message is two lines:

```
Dear {name}
{what happened}. {what it costs you, or what to do about it}
```

A newline is in the GSM-7 basic set and costs one character — cheaper than the
comma and space it replaces — so the structure is free, and the message reads as
a notification rather than a paragraph.

**The link goes last, with nothing after it.** A full stop touching a URL is
swallowed into the link by some handsets, and a customer who taps a 404 does not
try again. The tracking code is still spelled out even though the link ends in
it: the link is for tapping, the code is for reading back down the phone, and
those are two different acts by two different people.

**The bill and the endings carry a phone number, not a link.** On a payment
request the next act is a MoMo transfer; on a cancellation a number to call is
worth more than a page to look at.

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
message if it has not gone yet, so nobody is told about something that was
reversed two seconds later. Once a message has been *sent* it stays on the
record — the honest repair for that is the next message, not a quiet delete.

**Names are addressed, but never at double the price.** Every message opens on a
line of its own — "Dear Henry" — using the name of whoever the message is for.
If the greeting is what tips a message into a second segment, the greeting is
dropped rather than the cost doubled.

**Bad numbers are refused, not queued.** Phone numbers are normalised to
Ghanaian E.164 (`0554431300` → `233554431300`) when the row is written. A number
that cannot be one — a landline, a foreign number, a typo — gets no row at all,
and a warning in the log. The dispatch endpoint reports which of the two
messages actually queued, so the office learns about an unusable number while
the parcel is still in front of them.

---

## Running it

```sh
npm run sms:preview          # every message, with its length and cost
npm run sms:outbox           # what is queued, sent and failed. Sends nothing
npm run sms:outbox -- --send # actually send the queue
```

**Provider:** Arkesel. The API key is in `.env` as `SMS_API_KEY`; the balance is
visible in `npm run sms:outbox`.

**The MoMo number in the payment request is `CONTACT_PHONE`** from
`src/brand.ts` — the same number printed on the flyer. If money should go to a
different merchant or till number, that is the one line to change.

## Where the code is

| File | What it holds |
|------|---------------|
| `src/server/notifications.ts` | Which events earn a message, who each goes to, and the wording |
| `src/server/sms.ts` | GSM-7 sanitising, segment counting, Ghanaian number normalising |
| `src/server/smsProvider.ts` | The only file that talks to Arkesel |
| `src/server/outbox.ts` | The worker: batching, retries, giving up |
| `src/server/automations.ts` | Triggers message 1 |
| `src/server/routes/orders.ts` | Triggers messages 4, 5 and 6 |
| `src/server/routes/bookings.ts` | Triggers message 2 for a multi-parcel booking, and message 3 at weigh-in |
| `src/server/routes/rider.ts` | The courier's collection leg. Sends nothing itself |
