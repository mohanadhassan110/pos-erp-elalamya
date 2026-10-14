/**
 * Phase 15-E: render the barcode print output under print-media emulation (the same CSS the browser
 * print engine uses) and save PNGs. This is not a capture of the OS/Chrome print dialog, which headless
 * Chrome cannot show; the matching PDFs from page.pdf() are produced by phase15e-evidence.cjs.
 */
const puppeteer = require('d:/elalamya-main/frontend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUT = path.resolve(__dirname, '../docs/evidence/phase-15e');
const lines = [];
const log = (...a) => {
  const l = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  console.log(l);
  lines.push(l);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 2 });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  await page.type('#login-input', 'owner');
  await page.type('#password-input', 'password123'); // seeded local test credentials
  await page.click('button[type="submit"]');
  await page.waitForSelector('#login-input', { hidden: true });
  await page.goto(`${BASE_URL}/barcodes`, { waitUntil: 'networkidle0' });
  for (const term of ['لحاف', 'بطانية', 'فوط']) {
    await page.type('input[aria-label="بحث عن صنف لإضافته"]', term);
    await page.waitForSelector('[role=listbox] button');
    await page.keyboard.press('Enter');
    await sleep(500);
  }
  await sleep(1500);

  for (const [format, file] of [['thermal-50x25', '04-print-media-thermal-50x25.png'], ['a4-4x8', '04d-print-media-a4-4col.png']]) {
    await page.click(`input[value="${format}"]`);
    await sleep(800);
    await page.emulateMediaType('print');
    await sleep(500);
    const info = await page.evaluate(() => {
      const sheets = [...document.querySelectorAll('#printable-root .barcode-print-sheet')];
      const rects = sheets.map((s) => s.getBoundingClientRect());
      const px2mm = (v) => +(v * 25.4 / 96).toFixed(1);
      return {
        pageRule: document.querySelector('#printable-root style')?.textContent,
        sheets: sheets.length,
        sheetSizeMm: rects[0] ? `${px2mm(rects[0].width)}x${px2mm(rects[0].height)}` : null,
        labelsPerSheet: sheets.map((s) => s.querySelectorAll('svg').length),
        clip: rects.length ? { x: Math.min(...rects.map((r) => r.left)), y: 0, width: Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)), height: Math.max(...rects.map((r) => r.bottom)) } : null,
      };
    });
    log(format, { pageRule: info.pageRule, sheets: info.sheets, sheetSizeMm: info.sheetSizeMm, labelsPerSheet: info.labelsPerSheet });
    await page.screenshot({ path: path.join(OUT, 'screens', file), clip: info.clip, captureBeyondViewport: true });
    log(`saved screens/${file}`);
    await page.emulateMediaType(null);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'raw', 'print-render.log'), lines.join('\n') + '\n');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
