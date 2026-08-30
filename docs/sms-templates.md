# SMS messages

```
Dear {name}
We have received your delivery request and your order has been assigned to {rider}. He will call you from {riderPhone}

Use {code} to track your parcel here {link}
```

```
Dear {name}
We have received your delivery request and your order has been assigned to {rider}. He will call you when he arrives

Use {code} to track your parcel here {link}
```

```
Dear {name}
We have your {n} parcels. Prices confirm when we weigh each one. Use {ref} to track them here: {refLink}
```

```
Dear {name}
{code} weighed {weight}kg, so the price is {amount}, not {oldAmount}. Pay by MoMo to {office} and it goes on the bus.
```

```
Dear {name}
{code} weighed {weight}kg. Pay {amount} by MoMo to {office} and it goes on the bus.
```

```
Dear {name}
{sender} has sent you a parcel, {code}. It weighed {weight}kg. Pay {amount} by MoMo to {office} and it goes on the bus.
```

```
Dear {name}
Your parcel to {recipient} is on {bus}

Use {code} to track here {link}
```

```
Dear {name}
Your parcel from {sender} is on {bus}

Use {code} to track here {link}
```

```
Dear {name}
{code} has been cancelled and you have not been charged. Call {office} if this is a mistake.
```

```
Dear {name}
{code} has been cancelled. We will call you about your refund. Call {office}.
```

---

## Placeholders

| | |
|---|---|
| `{name}` | First name of whoever the message is for |
| `{sender}` | Sender's first name |
| `{recipient}` | Recipient's first name |
| `{rider}` | Rider's first name, or `A rider` |
| `{riderPhone}` | Rider's number, local form: `0244123456` |
| `{code}` | `GD-4821-330` |
| `{ref}` | `GDB-4821-330` |
| `{n}` | Number of parcels |
| `{amount}` `{oldAmount}` | `GHS 60.00` |
| `{weight}` | `4.2` |
| `{bus}` | `GT 4821 24` |
| `{link}` | `godispatchgh.com/t/{code}` |
| `{refLink}` | `godispatchgh.com/t/{ref}` |
| `{office}` | `054 030 4994` |

Source: `src/server/notifications.ts`. `npm run sms:preview` prints them filled in.

The first one is two segments already and always has been — see
`docs/sms-messages.md` for why that wording is worth the second credit.

Of the ones that fit in a single segment, the tightest are the recipient-pays
bill (19 characters spare at worst) and the multi-parcel confirmation (17).
Adding words to either needs `npm run sms:preview` run first, or it becomes two
messages and bills twice on every parcel.

Moving from `go-dispatch.onrender.com` to `godispatchgh.com` returned eight
characters to every message carrying `{link}` or `{refLink}`. That is why the
multi-parcel confirmation now has 17 characters of room instead of 9.
