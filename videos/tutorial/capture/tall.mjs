// TALL captures — the whole page in one image, so the screenshot can scroll
// inside the phone frame. Single-viewport shots have zero room to move, which
// is what made the first cut read as a slideshow.
//
// Scrolls the page all the way down before shooting, because the site reveals
// sections on scroll and a cold fullPage capture leaves dead bands where the
// unrevealed content should be.
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5199';
const OUT = 'C:/Users/henry/AppData/Local/Temp/gd-video/tall';
fs.mkdirSync(OUT, { recursive: true });

const FAKE_TRACK = [{
  id: 'demo-1', trackingCode: 'GD-4821-330',
  senderName: 'Ama Boateng', recipientName: 'Kwesi Mensah',
  pickupAddress: 'Adabraka, Accra', dropoffAddress: 'Kumasi, Ashanti',
  packageSize: 'Medium', packageDescription: 'Documents and a pair of shoes',
  scheduledPickupAt: '2026-08-30T09:00:00.000Z',
  status: 'dispatched', paymentStatus: 'paid', busCarNumber: 'GT 4821 24',
  createdAt: '2026-08-30T07:10:00.000Z',
  timeline: [
    { status: 'requested',  changedAt: '2026-08-30T07:10:00.000Z' },
    { status: 'confirmed',  changedAt: '2026-08-30T07:25:00.000Z' },
    { status: 'queued',     changedAt: '2026-08-30T08:05:00.000Z' },
    { status: 'picked_up',  changedAt: '2026-08-30T09:12:00.000Z' },
    { status: 'at_office',  changedAt: '2026-08-30T10:02:00.000Z' },
    { status: 'paid',       changedAt: '2026-08-30T10:20:00.000Z' },
    { status: 'to_station', changedAt: '2026-08-30T11:00:00.000Z' },
    { status: 'dispatched', note: 'On bus GT 4821 24', changedAt: '2026-08-30T11:40:00.000Z' },
  ],
}];

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

await page.setRequestInterception(true);
page.on('request', (r) => {
  if (r.url().includes('/api/orders/track')) {
    return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_TRACK) });
  }
  if (r.method() === 'POST' && r.url().includes('/api/bookings')) return r.abort();
  r.continue();
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Walk the whole page so every scroll-reveal has fired, then return to top. */
async function settle() {
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await wait(130);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(700);
}

async function tall(name) {
  await settle();
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const h = await page.evaluate(() => document.body.scrollHeight);
  console.log(`${name.padEnd(18)} page height ${h}px  (image ${h * 2}px tall)`);
}

async function typeInto(ph, v) {
  const el = await page.$(`[placeholder="${ph}"]`);
  if (!el) { console.log('  MISSING', ph); return; }
  await el.click(); await el.type(v, { delay: 6 });
}
async function clickText(t) {
  await page.evaluate((s) => {
    const el = [...document.querySelectorAll('button,a')].find((e) => e.textContent.trim().toLowerCase().startsWith(s.toLowerCase()));
    el && el.click();
  }, t);
  await wait(900);
}

// ---- home ----
await page.goto(BASE + '/', { waitUntil: 'networkidle2' }); await wait(1600);
await tall('home');

// ---- booking, step by step ----
await page.goto(BASE + '/book', { waitUntil: 'networkidle2' }); await wait(1500);
await typeInto('e.g. Ama Osei', 'Ama Boateng');
await typeInto('e.g. 0244123456', '0244815203');
await typeInto('e.g. Block C, Airport Residential Area', 'Block C, Airport Residential Area');
await typeInto('e.g. Opposite the French School', 'Opposite the French School');
await tall('step1');

await clickText('Continue');
await typeInto('e.g. Kofi Mensah', 'Kwesi Mensah');
await typeInto('e.g. 0207987654', '0207987654');
await typeInto('e.g. Lamashegu, near the Total station', 'Adum, near the Post Office');
await typeInto('e.g. documents', 'Documents and a pair of shoes');
await clickText('Choose a region');
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((e) => /^Ashanti/.test(e.textContent.trim()));
  el && el.click();
});
await wait(900);
await tall('step2');

await clickText('Continue');
await tall('step3');

// ---- tracking ----
await page.goto(BASE + '/t/GD-4821-330', { waitUntil: 'networkidle2' }); await wait(1600);
await tall('track');

await browser.close();
console.log('\nwrote to', OUT);
