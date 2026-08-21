# SMS messages

Every text GO DISPATCH sends, with the placeholders left in.

Each one goes out as two lines:

```
Dear {name}
<the message below>
```

---

## Booking confirmed → sender

Several parcels booked together:
```
We have your {n} parcels. Prices confirm when we weigh each one. Use {ref} to track them here: {refLink}
```

Already paid:
```
Payment received and we have your parcel. Use {code} to track it here: {link}
```

Prepaid, payment not in yet:
```
We have your parcel and collect once your payment lands. Use {code} to track it here: {link}
```

Paying on delivery:
```
We have your parcel. Payment is due on delivery. Use {code} to track it here: {link}
```

## Price confirmed → sender

```
{code} weighed {weight}kg, so the price is {amount}, not {oldAmount}. Track it here: {link}
```
```
{code} weighed {weight}kg and the price is {amount}. Track it here: {link}
```
```
{code} has been weighed, so the price is {amount}, not {oldAmount}. Track it here: {link}
```
```
{code} has been weighed and the price is {amount}. Track it here: {link}
```

## Rider assigned → sender

```
{rider} is coming to collect {code}. He will call from {riderPhone}. Track it here: {link}
```
```
{rider} is coming to collect {code} and will call when he arrives. Track it here: {link}
```

## Out for delivery → recipient

Recipient is paying at the door:
```
{sender} has sent you a parcel, arriving today. Have {amount} ready for the rider. Track it here: {link}
```

Already paid:
```
{sender} has sent you a parcel, arriving today. The rider will call you. Track it here: {link}
```

## Delivered → sender

Cash collected at the door:
```
{code} was delivered to {recipient} and {amount} was collected. Thank you.
```

Prepaid:
```
{code} was delivered to {recipient}. Thank you for choosing us.
```

## Cancelled → sender

Nothing had been paid:
```
{code} has been cancelled and you have not been charged. Call {office} if this is a mistake.
```

Already paid:
```
{code} has been cancelled. We will call you about your refund. Call {office}.
```

## Payment received → sender *(retired, no longer sent)*

```
Payment received for {code}. Thank you.
```

---

## Placeholders

| | |
|---|---|
| `{name}` | First name of whoever the message is for |
| `{sender}` | Sender's first name |
| `{recipient}` | Recipient's first name |
| `{rider}` | Rider's first name, or `A rider` |
| `{riderPhone}` | Rider's number |
| `{code}` | `GD-4821-330` |
| `{ref}` | `GDB-4821-330` |
| `{n}` | Number of parcels |
| `{amount}` `{oldAmount}` | `GHS 60.00` |
| `{weight}` | `4.2` |
| `{link}` | `go-dispatch.onrender.com/t/{code}` |
| `{refLink}` | `go-dispatch.onrender.com/t/{ref}` |
| `{office}` | `054 030 4994` |

Source: `src/server/notifications.ts`. `npm run sms:preview` prints them filled in.
