/**
 * Phase 15-E Task 1.4: capture the POS areas that still use Tailwind-style classes (cart row,
 * external-product form) so the reviewer can judge them. Adds one item to the cart; nothing is saved.
 */
const puppeteer = require('d:/elalamya-main/frontend/node_modules/puppeteer-core');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SCREENS = path.resolve(__dirname, '../docs/evidence/phase-15e/screens');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  await page.type('#login-input', 'cashier');
  await page.type('#password-input', 'password123'); // seeded local test credentials
  await page.click('button[type="submit"]');
  await page.waitForSelector('#login-input', { hidden: true });
  await page.goto(`${BASE_URL}/pos`, { waitUntil: 'networkidle0' });
  await sleep(1500);
  const scan = 'input[placeholder*="امسح الباركود"]';
  await page.type(scan, 'L0001', { delay: 20 });
  await page.keyboard.press('Enter');
  await sleep(1500);
  await page.screenshot({ path: path.join(SCREENS, '12-pos-cart-row-tailwind-classes-1366.png') });
  console.log('saved screens/12-pos-cart-row-tailwind-classes-1366.png');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('صنف خارجي'))?.click());
  await sleep(800);
  await page.screenshot({ path: path.join(SCREENS, '12b-pos-external-product-form-tailwind-classes-1366.png') });
  console.log('saved screens/12b-pos-external-product-form-tailwind-classes-1366.png');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
