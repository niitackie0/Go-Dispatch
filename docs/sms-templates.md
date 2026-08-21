# SMS messages

```
Dear {name}
We have your request. {rider} is collecting it, on {riderPhone}

Use {code} to track here {link}
```

```
Dear {name}
We have your request. {rider} is collecting it and will call on arrival

Use {code} to track here {link}
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
| `{link}` | `go-dispatch.onrender.com/t/{code}` |
| `{refLink}` | `go-dispatch.onrender.com/t/{ref}` |
| `{office}` | `054 030 4994` |

Source: `src/server/notifications.ts`. `npm run sms:preview` prints them filled in.

The first one is the tightest in the set — 10 to 20 characters spare depending on
the names. Adding words to it needs `npm run sms:preview` run first, or it
becomes two messages and bills twice on every parcel.
