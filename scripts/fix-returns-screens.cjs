const puppeteer = require('d:/elalamya-main/frontend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://127.0.0.1';
const SCREENS_DIR = path.resolve(__dirname, '../docs/evidence/phase15d/screens');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('--- REFINING RETURNS SCREENS ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();

    // Log in as Owner
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#login-input');
    await page.type('#login-input', 'owner');
    await page.type('#password-input', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#login-input', { hidden: true, timeout: 10000 });
    await sleep(1500);

    // 1. Returns Page Flow with Live Summary & Cashier Checkbox (scrolled to view bottom card)
    console.log('1. Returns Page Summary & Checkbox...');
    await page.goto(`${BASE_URL}/returns`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    await page.type('input[placeholder*="مثال: INV"]', 'INV-20261011-0002');
    await sleep(400);
    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('بحث عن الفاتورة'));
      if (submitBtn) submitBtn.click();
    });
    await sleep(1500);

    // Use React prototype setter for the quantity input
    await page.evaluate(() => {
      const input = document.querySelector('table input[type="number"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, '1');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(1000);

    // Scroll to the live summary card
    await page.evaluate(() => {
      const checkbox = document.getElementById('cashier-confirm-checkbox');
      if (checkbox) {
        checkbox.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });
    await sleep(800);

    await page.setViewport({ width: 1366, height: 768 });
    await sleep(400);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'returns-page-summary-1366.png') });
    console.log('Saved: returns-page-summary-1366.png');

    await page.setViewport({ width: 1920, height: 1080 });
    await sleep(400);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'returns-page-summary-1920.png') });
    console.log('Saved: returns-page-summary-1920.png');

    // 2. Returns History Modal
    console.log('2. Returns History Details Modal...');
    await page.goto(`${BASE_URL}/returns`, { waitUntil: 'networkidle0' });
    await sleep(1500);

    // Click 'سجل المرتجعات السابقة'
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const histTab = tabs.find(b => b.innerText.includes('سجل المرتجعات السابقة'));
      if (histTab) histTab.click();
    });
    await sleep(2000);

    // Check if table rows exist
    const hasRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      return rows.length;
    });
    console.log(`History table rows found: ${hasRows}`);

    // Click 'عرض' button on row
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      for (const row of rows) {
        const btn = Array.from(row.querySelectorAll('button')).find(b => b.innerText.includes('عرض'));
        if (btn) {
          btn.click();
          break;
        }
      }
    });
    await sleep(1500);

    await page.setViewport({ width: 1366, height: 768 });
    await sleep(400);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'return-details-modal-1366.png') });
    console.log('Saved: return-details-modal-1366.png');

    await page.setViewport({ width: 1920, height: 1080 });
    await sleep(400);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'return-details-modal-1920.png') });
    console.log('Saved: return-details-modal-1920.png');

    console.log('--- RETURNS SCREENS REFINED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Error in fix-returns-screens:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
