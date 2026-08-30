# GO DISPATCH — customer tutorial video

A silent, vertical (1080×1920) how-to for GO DISPATCH's own customers: how to
book a parcel and how to track it. Built with HyperFrames.

Silent on purpose — social video is watched muted, and it keeps the TTS and
whisper dependencies out of the build entirely.

## Render it

Lives on the `feature-tutorial-video` branch and **is not meant for `main`** —
it is a marketing asset, not part of the product that deploys.

```powershell
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
cd "C:\Users\henry\Desktop\web insight design projects\waypoint\videos"
npx -y hyperframes@latest check  tutorial
npx -y hyperframes@latest render tutorial --output tutorial/go-dispatch-how-to.mp4 --quality high --fps 30 --workers 2
```

The MP4 and `snapshots/` are gitignored — both regenerate from `index.html`
plus `assets/`, and the render takes about four and a half minutes.

`--workers 2`, not the `auto` default: each worker spawns its own Chrome and
this machine runs with very little free memory.

The `$env:Path` line is not optional. FFmpeg is on the persisted user PATH, so
any shell started before it was installed cannot see it and the render fails
with "FFmpeg not found", which looks exactly like a broken install.

## Where the footage came from

Every screen in the phone frame is a real screenshot of the real product, taken
from a local server running the `dev` branch. `capture/` holds the two scripts
that produced them.

Two things those scripts do deliberately:

- **The API is stubbed.** The tracking response is invented (`Ama Boateng`,
  `Kwesi Mensah`, bus `GT 4821 24`). A marketing video must not carry a real
  customer's name, phone number or home address, and the live database is the
  only place real ones exist.
- **The booking POST is aborted.** Filling the wizard for the camera must not
  create an order or queue an SMS to a real Ghanaian number.

The server was run with `SMS_PROVIDER=` empty and `AUTOMATION=off` for the same
reason — see the note on `AUTOMATION` in `server.ts`.

## The one rule this video exists to keep

**GO DISPATCH is not door-to-door.** A rider collects to the Adabraka office,
the parcel is weighed and billed there, an intercity bus carries it, and the
recipient collects it at the bus station.

The website said otherwise until 30 Aug 2026 — including in its terms, which
promised a second delivery attempt to a door nobody visits. That copy is fixed
in the app repo now. Do not reintroduce a doorstep handover to this video,
whatever it does for the story.

Everything factual on screen is real and comes from the app: the flat rate, the
nine regions, the thirteen towns, the three booking steps, the seven-stage
tracking rail. No invented statistics, delivery times or customer counts.

## Files

| Path | What |
| --- | --- |
| `index.html` | The composition. One file, seven scenes. |
| `DESIGN.md` | Palette, type and motion — all lifted from `src/index.css`. |
| `assets/` | The eight product screenshots, resized to 500×1082. |
| `capture/` | The Puppeteer scripts that took them. |
| `snapshots/` | Frames from `hyperframes snapshot`, for review. |
| `go-dispatch-how-to.mp4` | The finished MP4 (gitignored — render it). |
