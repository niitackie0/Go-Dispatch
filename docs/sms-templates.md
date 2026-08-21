# SMS templates — every message, with its placeholders

The exact wording of every text GO DISPATCH can send, in template form.

This is the page for **editing copy**. Its sibling
[`sms-messages.md`](sms-messages.md) is the page for understanding *when* each
message fires and *why* it exists, with the templates filled in as examples.

The templates below are transcribed from `src/server/notifications.ts`, which
is the source of truth. `npm run sms:preview` renders every one of them with
its real length and cost.

---

## Placeholders

| Placeholder | What it holds | Typical length |
|---|---|---|
| `{name}` | Greeting name: the **first word** of the sender's name — or the recipient's, on message 4. "Ama Serwaa" → "Ama" | 3–8 |
| `{sender}` | First word of the sender's name, used inside message 4's body | 3–8 |
| `{recipient}` | First word of the recipient's name, used inside message 5 | 3–8 |
| `{rider}` | First word of the rider's name, or the literal `A rider` if the fleet row has no name | 4–8 |
| `{riderPhone}` | The rider's number exactly as stored on the fleet | 13 |
| `{code}` | Tracking code, e.g. `GD-4821-330` | 11 |
| `{ref}` | Booking reference, e.g. `GDB-4821-330` | 12 |
| `{n}` | How many parcels were booked together | 1–2 |
| `{amount}` | Price, formatted `GHS 60.00` | 9–10 |
| `{oldAmount}` | The price before the parcel was weighed | 9–10 |
| `{weight}` | Scale weight in kg, e.g. `4.2` | 1–4 |
| `{link}` | `go-dispatch.onrender.com/t/{code}` | **38** |
| `{refLink}` | `go-dispatch.onrender.com/t/{ref}` | **39** |
| `{office}` | The office number, `054 030 4994` | 12 |

`{link}` is by far the most expensive thing in any message — over a fifth of a
single segment on its own. It is also the reason the code is spelled out
separately: the link is for tapping, the code is for reading back down a phone.

---

## The wrapper every message goes through

```
Dear {name}
{body}
```

Two lines, always. A newline is in the GSM-7 basic set and costs one character,
which is less than the comma and space it replaces — so the second line is free.

**If the greeting would cost a second segment, the greeting is dropped** and the
message is sent as `{body}` alone. Same if the name is empty. This is a
fallback, not a variant to write for.

**While the sender ID is unregistered**, `GO DISPATCH: ` (13 characters) is
prepended to the whole thing, greeting included. It is registered today —
`SMS_SENDER_ID_REGISTERED` in `src/brand.ts` — so the budgets below assume no
prefix. Setting that flag back to `false` costs every message 13 characters.

---

## Reading the budgets

Each template carries a line like:

> Fixed 78 · room 82

**Fixed** is the literal text, wrapper included — the characters that are there
no matter what. **Room** is what remains of the 160-character segment for all
the placeholder values *combined*, greeting name included.

So `1d` below has 82 characters of room, and a typical filling —
`{name}` 5 + `{code}` 11 + `{link}` 38 = 54 — leaves 28 spare. Anything that
overflows is billed as two messages, on every order, forever.

---

## 1. Booking confirmed → the sender

Four variants, **chosen in this order** — the first match wins.

### 1a. Several parcels booked together
*When a booking has a reference and more than one parcel.*

```
We have your {n} parcels. Prices confirm when we weigh each one. Use {ref} to track them here: {refLink}
```

> Fixed 93 · room 67 — **tight**: a typical filling uses 57, leaving 10.

### 1b. Already paid for
*When `paymentStatus` is `paid`.*

```
Payment received and we have your parcel. Use {code} to track it here: {link}
```

> Fixed 71 · room 89

### 1c. Prepaid, payment not in yet
*When `paymentTiming` is `prepaid` and it has not been paid. Only reachable if
an admin confirms such an order by hand — a decision to collect before payment.*

```
We have your parcel and collect once your payment lands. Use {code} to track it here: {link}
```

> Fixed 86 · room 74

### 1d. Paying on delivery
*Everything else. The common case.*

```
We have your parcel. Payment is due on delivery. Use {code} to track it here: {link}
```

> Fixed 78 · room 82

---

## 2. Price confirmed → the sender

Sent **only when weighing actually changed the price**. The opening fragment
depends on whether a weight was recorded; the ending on whether we know the old
price. In practice `2a` is the one that sends.

### 2a. Weighed, and the price moved
```
{code} weighed {weight}kg, so the price is {amount}, not {oldAmount}. Track it here: {link}
```

> Fixed 58 · room 102

### 2b. Weighed, no earlier price to compare
```
{code} weighed {weight}kg and the price is {amount}. Track it here: {link}
```

> Fixed 52 · room 108

### 2c. No weight recorded, price moved
```
{code} has been weighed, so the price is {amount}, not {oldAmount}. Track it here: {link}
```

> Fixed 64 · room 96

### 2d. No weight recorded, no earlier price
```
{code} has been weighed and the price is {amount}. Track it here: {link}
```

> Fixed 58 · room 102

---

## 3. Rider assigned → the sender

`{rider}` falls back to the literal `A rider` when the fleet row has no name.

### 3a. The rider has a number on file
```
{rider} is coming to collect {code}. He will call from {riderPhone}. Track it here: {link}
```

> Fixed 65 · room 95

### 3b. No number on file
```
{rider} is coming to collect {code} and will call when he arrives. Track it here: {link}
```

> Fixed 75 · room 85

---

## 4. Out for delivery → **the recipient**

The only message that reaches somebody who never dealt with us, which is why it
names the sender. `{name}` here is the **recipient's** first name.

### 4a. The recipient is paying at the door
*When `payer` is `recipient` and it has not been paid.*

```
{sender} has sent you a parcel, arriving today. Have {amount} ready for the rider. Track it here: {link}
```

> Fixed 88 · room 72 — **tight**: long names with a three-figure amount leave 7.

### 4b. Already paid for
```
{sender} has sent you a parcel, arriving today. The rider will call you. Track it here: {link}
```

> Fixed 86 · room 74

---

## 5. Delivered → the sender

Ends on a full stop, not a link: the parcel's story is over and there is nothing
left to watch.

### 5a. Cash collected at the door
*When `paymentTiming` is `on_delivery` and it is now `paid`.*

```
{code} was delivered to {recipient} and {amount} was collected. Thank you.
```

> Fixed 55 · room 105

### 5b. Prepaid
```
{code} was delivered to {recipient}. Thank you for choosing us.
```

> Fixed 52 · room 108

---

## 6. Cancelled → the sender

Ends on the office number rather than a link — on a cancellation, somebody to
ring is worth more than a page to look at.

### 6a. Nothing had been paid
```
{code} has been cancelled and you have not been charged. Call {office} if this is a mistake.
```

> Fixed 84 · room 76

### 6b. Already paid for
```
{code} has been cancelled. We will call you about your refund. Call {office}.
```

> Fixed 69 · room 91

---

## Retired: payment received

No longer queued — a prepaid order is confirmed by the same automation pass that
sees the payment, so this arrived in the same second as message 1 saying half of
the same sentence, and was billed twice. Message `1b` covers it.

Kept in the code so notification rows written before it was retired still render.

```
Payment received for {code}. Thank you.
```

> Fixed 39 · room 121

---

## If you edit any of these

1. **Keep every character in the GSM-7 alphabet.** One curly apostrophe pasted
   from a document — `don’t` instead of `don't` — drops the segment limit from
   160 to 70 and triples the bill. Same for em dashes, ellipses and accents.
   The sanitiser in `src/server/sms.ts` will straighten them, but write them
   straight: a character it cannot fold is dropped, not rendered.
2. **Leave the link last, with nothing after it.** A full stop touching a URL
   gets swallowed into the link by some handsets, and a customer who taps a 404
   does not try again.
3. **Run `npm run sms:preview`.** It prints every variant with its real length,
   segment count and headroom, and flags anything with under 20 characters
   spare. Nothing should ever read `2 segments`.
4. **Old messages do not change.** Text is rendered when the event happens and
   stored on the notification row, so an edit here only affects messages queued
   from that point on. What a customer was already told stays what they were
   told.

---

## Where this comes from

| File | What it holds |
|---|---|
| `src/server/notifications.ts` | These templates, who each message goes to, and the branch conditions |
| `src/server/sms.ts` | GSM-7 sanitising and segment counting |
| `src/brand.ts` | `{link}` origin, `{office}`, and the sender-ID flag |
| `src/pricing.ts` | `formatAmount`, which produces `{amount}` |
| `scripts/sms-preview.ts` | `npm run sms:preview` |
