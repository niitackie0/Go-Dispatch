# SMS messages

```
Dear {name}
We have your parcel. The price confirms when we weigh it. Use {code} to track it here: {link}
```

```
Dear {name}
We have your {n} parcels. Prices confirm when we weigh each one. Use {ref} to track them here: {refLink}
```

```
Dear {name}
{rider} is coming to collect {code}. He will call from {riderPhone}. Track it here: {link}
```

```
Dear {name}
{rider} is coming to collect {code} and will call when he arrives. Track it here: {link}
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
{code} is on the bus, car number {bus}. {recipient} has been told the same. Call {office} if anything is wrong.
```

```
Dear {name}
{sender} has sent you a parcel on the bus, car number {bus}. Collect it at the station. Call {office} if you need us.
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
| `{riderPhone}` | Rider's number |
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
