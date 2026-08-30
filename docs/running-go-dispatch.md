# Running GO DISPATCH

For whoever is at the desk. No technical knowledge assumed, and nothing here
needs a terminal except the last section, which exists for the day nobody can
sign in.

The console is at **/ops** on your own address. Sign in stays valid for seven
days, so most mornings it opens straight to the board.

---

## The day, in order

The order is the order the board enforces — `src/transitions.ts` refuses
anything else, so you cannot skip a step by accident.

**A parcel is booked.** It arrives on the dispatch board as *Requested*.
Nothing has been promised yet, and nothing is texted yet either.

**Confirm it.** *Requested → Confirmed* says the office has committed to
collecting it. After this the sender can no longer cancel online; they have to
ring you.

**It queues itself.** When the collection window opens, the system assigns a
free courier and marks it *For collection*. You do not do this by hand. This is
the point the sender is texted — one message that is both the receipt and the
collection notice, naming the rider and his number.

**The rider collects it.** *Collected*. The parcel is now on its way in to
Adabraka.

**It reaches the office.** *At the office*. Now weigh it: open the order and
enter the weight from the scale. That fixes the price — everything before it,
on the site and in the booking form, was an estimate — and it texts the bill to
whoever the parcel names as payer, which may be the recipient rather than the
sender.

**The money settles.** *Paid*, once the MoMo lands. Record it with **I have the
money**. This is a gate, not a formality: **nothing goes on a bus before it is
paid for.** Past the station we have no leverage and nobody at the far end, so
this is the last point at which the money can still be asked for.

**It goes to the station.** *To the station* if a rider runs it round, or
straight to *On the bus* if somebody walks it there. Either is legal.

**On the bus.** *Dispatched*, and you record the bus registration when you mark
it. That texts both the sender and the recipient the car number.

**That is the end of our job.** There is no status after *On the bus*, and the
board will not offer one. The recipient collects the parcel at the station in
the destination town. We cannot see the far end, so we do not claim to — a
status saying a parcel was collected would be a guess, and a guess is worse
than silence.

---

## Recording a payment

Open the order → **I have the money**.

It records the full price of the parcel unless you enter a different amount,
marks it paid, and puts a line in the ledger with your name and the time.

**Payments cannot be edited or deleted, by anyone.** That is deliberate. A
correction is a new line, so the ledger always shows both what happened and
what fixed it. If a payment was recorded in error, use Undo (below) within ten
minutes, or record the correction and write a note saying why.

---

## Fixing a mistake

**Within ten minutes — Undo.** Every status change can be taken back for ten
minutes. Open the order and the button is there. It reverses the side effects
too: a payment that was recorded automatically is voided, a courier is made
available again, and a text that was queued but not yet sent is pulled back.

Undo only ever steps back one move, and it will not undo something the system
did by itself.

**After ten minutes — an owner can override.** Only an owner, and only with a
written reason. The reason is stored on the order forever and shows in its
history as an override, so anyone reading it later can see that a human decided
this rather than the parcel having travelled that way.

**A booking that should not have happened — cancel it.** Open the order, under
*Other moves*, choose **Cancelled**. It is never deleted: the sender still has
a tracking link, and a link that stops working reads as *we lost your parcel*
rather than *that booking was called off*.

---

## Staff

**Somebody forgot their password.** Staff accounts → find them → **Issue new
password**. It shows you the new password once. Give it to them in person or by
phone; do not put it in an email or a WhatsApp message you cannot unsend.
Issuing a password signs that person out everywhere.

**Somebody is leaving.** Staff accounts → remove them. Their name stays on
everything they did — the history keeps the attribution even though the account
is gone.

**The roles.**

| Role | Can |
|---|---|
| **Owner** | Everything, including pricing and staff accounts |
| **Finance** | Payments, revenue, and read orders for context. No dispatch |
| **Support** | Orders, statuses and riders. No pricing, no payments |

Support is what a new colleague gets by default, and it is not a read-only
role: it can move any parcel through any legal status. There is no lesser one.

**There must always be at least one owner.** The system refuses to remove or
demote the last one, so you cannot lock everybody out by accident.

---

## When something is wrong

**The site is slow to load the first time.** Expected. The server sleeps after
fifteen quiet minutes and takes about a minute to wake. The first person in each
morning absorbs it. Everything after that is normal speed.

**Texts are not arriving.** Check the Arkesel balance first — messages stop
when credit runs out, and they queue rather than vanish, so they will send once
it is topped up.

**A customer says their tracking code does not work.** Ask them to check the
code, then try their phone number instead. Any format works: `024…`, `+233…`,
with spaces or without. If neither finds it, the parcel is genuinely not in the
system and the booking did not complete.

**The whole site is down.** Check https://godispatchgh.com/api/health.
If it says `{"ok":true}` the site is up and the problem is somewhere else. If it
does not answer at all, or says the database is unreachable, that is real.

---

## The way back in, if nobody can sign in

This is the only part that needs a computer with the project on it. Open a
terminal in the project folder:

```
npm run admin list                              who has an account
npm run admin password annanrichard26@gmail.com set a new password
```

It asks for the password at the keyboard and never shows it. It works without
being signed in, which is the point — it exists for the day the console cannot
help.

---

## Who to call

The office number is **054 030 4994** and lives in `src/brand.ts` — one file,
so changing it changes it everywhere: the site, the footer, and every text
message.

For anything in this document that does not match what the console actually
does, the console is right and this page is out of date. Say so.
