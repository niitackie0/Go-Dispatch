// Drives the booking wizard so the video shows a form being filled, not an
// empty one. Never submits: the POST is aborted, so no order is created and
// no text is queued.
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5199';
const OUT = 'C:/Users/henry/AppData/Local/Temp/gd-video/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

await page.setRequestInterception(true);
page.on('request', (r) => {
  if (r.method() === 'POST' && r.url().includes('/api/bookings')) return r.abort();
  r.continue();
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { await wait(600); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('shot', n); };

async function typeInto(placeholder, value) {
  const el = await page.$(`[placeholder="${placeholder}"]`);
  if (!el) { console.log('  MISSING field:', placeholder); return false; }
  await el.click();
  await el.type(value, { delay: 22 });
  return true;
}

async function clickText(label) {
  const clicked = await page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, a')];
    const el = els.find((e) => e.textContent.trim().toLowerCase().startsWith(t.toLowerCase()));
    if (el) { el.click(); return true; }
    return false;
  }, label);
  await wait(900);
  return clicked;
}

/** What a step is asking for, so fields can be filled without guessing. */
async function describe(tag) {
  const info = await page.evaluate(() => ({
    heading: document.querySelector('h1,h2')?.textContent?.trim(),
    step: document.body.innerText.match(/Step \d of \d/)?.[0],
    placeholders: [...document.querySelectorAll('input,textarea')].map((i) => i.placeholder).filter(Boolean),
    buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 8),
  }));
  console.log(`\n[${tag}]`, JSON.stringify(info, null, 1));
}

await page.goto(BASE + '/book', { waitUntil: 'networkidle2' });
await wait(1500);

await describe('step 1');
await typeInto('e.g. Ama Osei', 'Ama Boateng');
await typeInto('e.g. 0244123456', '0244815203');
await typeInto('e.g. Block C, Airport Residential Area', 'Block C, Airport Residential Area');
await typeInto('e.g. Opposite the French School', 'Opposite the French School');
await page.evaluate(() => window.scrollTo(0, 0));
await shot('flow-01-step1-filled');
await page.evaluate(() => window.scrollTo(0, 900));
await shot('flow-02-step1-when');

await clickText('Continue');
await page.evaluate(() => window.scrollTo(0, 0));
await describe('step 2');
await shot('flow-03-step2');

// --- Step 2: where it is going, and what it is ---
await typeInto('e.g. Kofi Mensah', 'Kwesi Mensah');
await typeInto('e.g. 0207987654', '0207987654');
await typeInto('e.g. Lamashegu, near the Total station', 'Adum, near the Post Office');
await typeInto('e.g. documents', 'Documents and a pair of shoes');

// The region picker is a modal, not a <select>.
await clickText('Choose a region');
await shot('flow-04-region-modal');
const picked = await page.evaluate(() => {
  // No  after the name: the row's text is "AshantiKumasi" with no separator,
  // and there is no word boundary between "i" and "K". No offsetParent check
  // either -- the sheet is position:fixed, so offsetParent is null for every
  // row in it.
  const el = [...document.querySelectorAll('button')]
    .find((e) => /^Ashanti/.test(e.textContent.trim()));
  if (el) { el.click(); return true; }
  return false;
});
console.log('picked Ashanti:', picked);
await wait(900);
await page.evaluate(() => window.scrollTo(0, 0));
await shot('flow-05-step2-filled');
await page.evaluate(() => window.scrollTo(0, 850));
await shot('flow-06-step2-lower');

await clickText('Continue');
await page.evaluate(() => window.scrollTo(0, 0));
await describe('step 3');
await shot('flow-07-step3');
await page.evaluate(() => window.scrollTo(0, 700));
await shot('flow-08-step3-lower');

await browser.close();
