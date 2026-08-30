# GO DISPATCH — tutorial video

A silent, vertical how-to for GO DISPATCH's own customers: how to book a parcel
and how to track it. Not an advert. The viewer is someone who has been given
the link and needs to know what the thing does.

Every value below is lifted from `src/index.css` in the product repo, not
chosen for the video. The video and the site have to look like one company.

## Style Prompt

Ghanaian courier service, printed-flyer red on warm off-white, with the dark
slate-and-red-glow ground the site uses for its hero. Confident, plain,
unfussy — a company that quotes one rate and means it. Big Inter display type,
generous whitespace, real screenshots of the real product in a plain phone
frame. Nothing decorative that isn't carrying information: no stock imagery, no
gradient soup, no floating 3D. The parcel's journey is the story, and it ends
at a bus, not a doorstep.

## Colors

| Token | Hex | Role |
| --- | --- | --- |
| `--gd-red` | `#D81E24` | The flyer's action red. Buttons, the rail, one word per headline. |
| `--gd-red-bright` | `#FF4A50` | Red type on the dark ground — `#D81E24` on slate-950 is too dim to read. |
| `--gd-red-dark` | `#A8141A` | Gradient end, pressed states. |
| `--gd-maroon` | `#5C0A0E` | Deep glow behind the dark ground. |
| `--gd-bg` | `#FBF7F7` | Warm off-white canvas — the light scenes. |
| `--gd-surface` | `#FFFFFF` | Cards, the phone frame's bezel highlight. |
| `--gd-ink` | `#1A1113` | Primary text on light. |
| `--gd-muted` | `#6B5C5F` | Secondary text on light. |
| `--gd-dark` | `#080A12` | The dark ground (site hero is slate-950 under two red glows). |
| `--gd-emerald` | `#047857` | Reserved for one thing only: the parcel reaching the bus. |

Gradient, as the site uses it:
`linear-gradient(115deg, #E8262C 0%, #D81E24 52%, #A8141A 100%)`

Contrast rules learned on this palette:
- `#D81E24` on `#080A12` is about 3.1:1 — fine for 60px+ display type, not for
  body. Use `#FF4A50` for anything under 40px on the dark ground.
- `#6B5C5F` on `#FBF7F7` clears 4.5:1. Do not lighten it further.

## Typography

- **Display and body:** Inter. 800/900 for headlines, 600 for labels, 400–500
  for body. Tight tracking on display (`-0.02em`), as `.font-display` does.
- **Codes, registrations, money:** JetBrains Mono. `GD-4821-330` and
  `GT 4821 24` are the two things a viewer might write down, so they get the
  mono treatment and `font-variant-numeric: tabular-nums`.
- Minimums for rendered video: 64px headlines, 30px body, 22px labels. The
  screenshots inside the phone frame are exempt — they are images.

## Motion

The product's own rule, and the video keeps it: **motion only ever says what
just changed.** No ambient drift, no parallax for its own sake.

- Entrances: `power3.out`, 0.5–0.7s, `y: 40–60`.
- The phone screen changes: a 0.35s cross-dissolve, never a slide — a slide
  implies the user swiped, and they tapped.
- The journey rail fills left to right, `power2.inOut`, one segment at a time.
- Scene changes: 0.5s dissolve through the dark ground.
- Nothing bounces. `back.out` and `elastic` are wrong for a company whose
  promise is that the price does not move.

## What NOT to Do

- **Never show a parcel arriving at a house or a hand-to-hand doorstep
  handover.** GO DISPATCH is not door-to-door. This is the single claim the
  whole rewrite exists to remove — putting it back in a video is worse than
  leaving it on the website.
- **But do not say "we are not a door-to-door service" either.** Owner's
  direction, 30 Aug: state where the parcel goes, not where it does not. The
  positive facts carry it — an intercity bus takes it, the recipient collects
  at the station, usually within **24 to 48 hours**. A disclaimer belongs in
  the terms, not in a tutorial.
- **A still screenshot in a phone frame is dead.** Every screen in the device
  must scroll, which means the asset has to be taller than the window plus its
  travel. This was the note the first cut ignored and it read as a slideshow.
- No invented statistics, delivery times, or customer counts. The rate,
  the region count and the town count are real and come from the app.
- No stock photography of couriers, vans or smiling models.
- No `#333`, no Roboto, no default Tailwind blue.
- No text over the busy part of the Ghana map — the region labels are already
  there and a headline on top of them makes both unreadable.
- Do not show a real customer's name, phone number or address. Every name in
  the footage is invented (Ama Boateng, Kwesi Mensah) and the API was stubbed
  to produce it.
