const puppeteer = require('d:/elalamya-main/frontend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://127.0.0.1';
const SCREENS_DIR = path.resolve(__dirname, '../docs/evidence/phase15d/screens');

fs.mkdirSync(SCREENS_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('--- CAPTURING TARGETED SCREENS ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();

    async function loginAsOwner() {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#login-input');
      await page.type('#login-input', 'owner');
      await page.type('#password-input', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForSelector('#login-input', { hidden: true, timeout: 10000 });
      await sleep(1500);
    }

    await loginAsOwner();

    // 1. A4 Print Preview of Replacement Invoice (1366 & 1920)
    console.log('1. A4 Print Preview...');
    await page.goto(`${BASE_URL}/invoices`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      for (const row of rows) {
        if (row.innerText.includes('INV-20261011-0003')) {
          const btn = Array.from(row.querySelectorAll('button')).find(b => b.innerText.includes('طباعة'));
          if (btn) btn.click();
          break;
        }
      }
    });
    await sleep(1200);
    // Click A4 tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const a4Btn = btns.find(b => b.innerText.includes('فاتورة A4 رسمية'));
      if (a4Btn) a4Btn.click();
    });
    await sleep(1000);

    await page.setViewport({ width: 1366, height: 768 });
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'invoice-print-preview-a4-1366.png') });
    console.log('Saved: invoice-print-preview-a4-1366.png');

    await page.setViewport({ width: 1920, height: 1080 });
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'invoice-print-preview-a4-1920.png') });
    console.log('Saved: invoice-print-preview-a4-1920.png');

    // 2. Returns Page Flow with Live Summary & Cashier Checkbox (1366 & 1920)
    console.log('2. Returns Page Summary & Checkbox...');
    await page.goto(`${BASE_URL}/returns`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    await page.type('input[placeholder*="مثال: INV"]', 'INV-20261011-0002');
    await sleep(400);
    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('بحث عن الفاتورة'));
      if (submitBtn) submitBtn.click();
    });
    await sleep(1500);
    // Increase quantity of first item to 1
    await page.evaluate(() => {
      const qtyInput = document.querySelector('table input[type="number"]');
      if (qtyInput) {
        qtyInput.value = '1';
        qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
        qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(1200);

    await page.setViewport({ width: 1366, height: 768 });
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'returns-page-summary-1366.png') });
    console.log('Saved: returns-page-summary-1366.png');

    await page.setViewport({ width: 1920, height: 1080 });
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'returns-page-summary-1920.png') });
    console.log('Saved: returns-page-summary-1920.png');

    // 3. Return Details Modal (History modal with exchange breakdown)
    console.log('3. Return Details Modal...');
    // Click History tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const histTab = tabs.find(b => b.innerText.includes('سجل المرتجعات السابقة'));
      if (histTab) histTab.click();
    });
    await sleep(2000);
    // Click 'عرض' on first row
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      if (rows.length > 0) {
        const btn = Array.from(rows[0].querySelectorAll('button')).find(b => b.innerText.includes('عرض'));
        if (btn) btn.click();
      }
    });
    await sleep(1500);

    await page.setViewport({ width: 1366, height: 768 });
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'return-details-modal-1366.png') });
    console.log('Saved: return-details-modal-1366.png');

    await page.setViewport({ width: 1920, height: 1080 });
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'return-details-modal-1920.png') });
    console.log('Saved: return-details-modal-1920.png');

    // 4. Owner Profit Report Drilldown Modal
    console.log('4. Owner Profit Report Drilldown Modal...');
    await page.goto(`${BASE_URL}/reports`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const histTab = tabs.find(b => b.innerText.includes('سجل الفواتير والعمليات') || b.innerText.includes('سجل الفواتير'));
      if (histTab) histTab.click();
    });
    await sleep(2000);
    // Click 'تفاصيل الربح'
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      for (const row of rows) {
        const btn = Array.from(row.querySelectorAll('button')).find(b => b.innerText.includes('تفاصيل الربح'));
        if (btn) {
          btn.click();
          break;
        }
      }
    });
    await sleep(1500);

    await page.setViewport({ width: 1366, height: 768 });
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'owner-profit-drilldown-1366.png') });
    console.log('Saved: owner-profit-drilldown-1366.png');

    await page.setViewport({ width: 1920, height: 1080 });
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'owner-profit-drilldown-1920.png') });
    console.log('Saved: owner-profit-drilldown-1920.png');

    console.log('--- TARGETED SCREENS CAPTURED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Error in targeted capture:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
