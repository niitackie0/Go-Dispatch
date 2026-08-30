// One-off capture for the tutorial video. Not part of the app; deleted after.
//
// Stubs the API rather than reading the live database: a marketing video must
// not carry a real customer's name, phone number or home address, and nothing
// here should write an order or queue a text.
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5199';
const OUT = 'C:/Users/henry/AppData/Local/Temp/gd-video/shots';
fs.mkdirSync(OUT, { recursive: true });

const VW = 390, VH = 844, DSF = 2;

// Invented, and obviously so. Kumasi is a real destination; the people are not.
const FAKE_TRACK = [
  {
    id: 'demo-1',
    trackingCode: 'GD-4821-330',
    senderName: 'Ama Boateng',
    recipientName: 'Kwesi Mensah',
    pickupAddress: 'Adabraka, Accra',
    dropoffAddress: 'Kumasi, Ashanti',
    packageSize: 'Medium',
    packageDescription: 'Documents and a pair of shoes',
    scheduledPickupAt: '2026-08-30T09:00:00.000Z',
    status: 'dispatched',
    paymentStatus: 'paid',
    busCarNumber: 'GT 4821 24',
    createdAt: '2026-08-30T07:10:00.000Z',
    timeline: [
      { status: 'requested', changedAt: '2026-08-30T07:10:00.000Z' },
      { status: 'confirmed', changedAt: '2026-08-30T07:25:00.000Z' },
      { status: 'queued', changedAt: '2026-08-30T08:05:00.000Z' },
      { status: 'picked_up', changedAt: '2026-08-30T09:12:00.000Z' },
      { status: 'at_office', changedAt: '2026-08-30T10:02:00.000Z' },
      { status: 'paid', changedAt: '2026-08-30T10:20:00.000Z' },
      { status: 'to_station', changedAt: '2026-08-30T11:00:00.000Z' },
      { status: 'dispatched', note: 'On bus GT 4821 24', changedAt: '2026-08-30T11:40:00.000Z' },
    ],
  },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});

const page = await browser.newPage();
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: DSF });

await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  // The tracking answer, invented.
  if (url.includes('/api/orders/track')) {
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_TRACK),
    });
  }
  // Never let a capture create a real booking or queue a real text.
  if (req.method() === 'POST' && url.includes('/api/bookings')) {
    return req.abort();
  }
  req.continue();
});

async function shot(name) {
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

async function go(path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1400)); // splash + reveal animations
}

// ---- Home, viewport by viewport (fullPage corrupts scroll-reveal pages) ----
await go('/');
const homeHeight = await page.evaluate(() => document.body.scrollHeight);
const steps = Math.min(9, Math.ceil(homeHeight / VH));
for (let i = 0; i < steps; i++) {
  await page.evaluate((y) => window.scrollTo(0, y), i * VH);
  await shot(`home-${String(i).padStart(2, '0')}`);
}

// ---- Booking form ----
await go('/book');
await shot('book-00');
await page.evaluate(() => window.scrollTo(0, 700));
await shot('book-01');
await page.evaluate(() => window.scrollTo(0, 1400));
await shot('book-02');

// ---- Tracking: the empty box, then the answer ----
await go('/track');
await shot('track-00-empty');
await go('/t/GD-4821-330');
await shot('track-01-result');
await page.evaluate(() => window.scrollTo(0, 620));
await shot('track-02-timeline');

await browser.close();
console.log('\nwrote to', OUT);
