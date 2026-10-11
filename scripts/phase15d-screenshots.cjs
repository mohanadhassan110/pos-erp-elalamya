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
  console.log('--- STARTING PHASE 15-D SCREENSHOT CAPTURE ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();

    async function loginAsOwner() {
      console.log('Logging in as Owner...');
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#login-input');
      await page.type('#login-input', 'owner');
      await page.type('#password-input', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForSelector('#login-input', { hidden: true, timeout: 10000 });
      await sleep(1500);
    }

    await loginAsOwner();

    // Helper to capture both viewports
    async function captureBoth(baseName, actionFn) {
      // 1366x768
      await page.setViewport({ width: 1366, height: 768 });
      if (actionFn) await actionFn('1366');
      await sleep(600);
      const file1366 = path.join(SCREENS_DIR, `${baseName}-1366.png`);
      await page.screenshot({ path: file1366 });
      console.log(`Saved: ${baseName}-1366.png`);

      // 1920x1080
      await page.setViewport({ width: 1920, height: 1080 });
      if (actionFn) await actionFn('1920');
      await sleep(600);
      const file1920 = path.join(SCREENS_DIR, `${baseName}-1920.png`);
      await page.screenshot({ path: file1920 });
      console.log(`Saved: ${baseName}-1920.png`);
    }

    // 1. POS Main Screen
    console.log('1. POS Main Screen...');
    await page.goto(`${BASE_URL}/pos`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="امسح الباركود"]');
    await captureBoth('pos-main');

    // 2. POS Catalog Dialog via button click or F2
    console.log('2. POS Catalog Dialog (F2)...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const catBtn = btns.find(b => b.innerText.includes('كتالوج الأصناف'));
      if (catBtn) catBtn.click();
    });
    await page.waitForSelector('input[placeholder*="ابحث بالاسم"]', { timeout: 10000 });
    await page.type('input[placeholder*="ابحث بالاسم"]', 'لحاف');
    await sleep(600);
    await page.keyboard.press('ArrowDown');
    await sleep(400);
    await captureBoth('pos-catalog-f2');

    // Close catalog
    await page.keyboard.press('Escape');
    await sleep(600);

    // 3. Invoices List Table
    console.log('3. Invoices List Table...');
    await page.goto(`${BASE_URL}/invoices`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    await captureBoth('invoices-list');

    // 4. Original Invoice Details (Partial Return badge)
    console.log('4. Original Invoice Details with Partial Return...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      for (const row of rows) {
        if (row.innerText.includes('INV-20261011-0001')) {
          const btn = Array.from(row.querySelectorAll('button')).find(b => b.innerText.includes('التفاصيل'));
          if (btn) btn.click();
          break;
        }
      }
    });
    await sleep(1200);
    await captureBoth('invoice-original-partial-return');

    // Close details modal
    await page.keyboard.press('Escape');
    await sleep(600);

    // 5. Replacement Invoice Details (Exchange Breakdown badge)
    console.log('5. Replacement Invoice Details...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      for (const row of rows) {
        if (row.innerText.includes('INV-20261011-0003')) {
          const btn = Array.from(row.querySelectorAll('button')).find(b => b.innerText.includes('التفاصيل'));
          if (btn) btn.click();
          break;
        }
      }
    });
    await sleep(1200);
    await captureBoth('invoice-replacement-details');

    // Close details modal
    await page.keyboard.press('Escape');
    await sleep(600);

    // 6. Print Preview of Replacement Invoice (Thermal & A4)
    console.log('6. Print Preview of Replacement Invoice...');
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
    await sleep(1500);

    // Thermal view
    await page.setViewport({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'invoice-print-preview-thermal-1366.png') });
    console.log('Saved: invoice-print-preview-thermal-1366.png');

    // Switch to A4 tab in modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const a4Btn = btns.find(b => b.innerText.includes('ورق عادي A4'));
      if (a4Btn) a4Btn.click();
    });
    await sleep(800);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'invoice-print-preview-a4-1366.png') });
    console.log('Saved: invoice-print-preview-a4-1366.png');

    // Close print modal
    await page.keyboard.press('Escape');
    await sleep(600);

    // 7. Returns Page - New return with live financial summary & checkbox
    console.log('7. Returns Page Flow...');
    await page.goto(`${BASE_URL}/returns`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    // Search and select invoice INV-20261011-0002
    await page.type('input[placeholder*="مثال: INV"]', 'INV-20261011-0002');
    await sleep(400);
    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('بحث عن الفاتورة'));
      if (submitBtn) submitBtn.click();
    });
    await sleep(1500);
    await captureBoth('returns-page-summary');

    // 8. Return Details Modal (History modal showing exchange link & items)
    console.log('8. Return Details Modal...');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const histTab = tabs.find(b => b.innerText.includes('سجل المرتجعات'));
      if (histTab) histTab.click();
    });
    await sleep(1500);
    // Click details button 'عرض' on first return row
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      if (rows.length > 0) {
        const btn = Array.from(rows[0].querySelectorAll('button')).find(b => b.innerText.includes('عرض'));
        if (btn) btn.click();
      }
    });
    await sleep(1200);
    await captureBoth('return-details-modal');

    // Close modal
    await page.keyboard.press('Escape');
    await sleep(600);

    // 9. Owner Profit Report Table
    console.log('9. Owner Profit Report Table...');
    await page.goto(`${BASE_URL}/reports`, { waitUntil: 'networkidle0' });
    await sleep(1500);

    // Switch to history tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const histTab = tabs.find(b => b.innerText.includes('سجل الفواتير والعمليات') || b.innerText.includes('سجل الفواتير'));
      if (histTab) histTab.click();
    });
    await sleep(1500);
    await captureBoth('owner-profit-report');

    // 10. Owner Profit Report Drilldown Modal
    console.log('10. Owner Profit Drilldown Modal...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      for (const row of rows) {
        const btn = Array.from(row.querySelectorAll('button')).find(b => b.innerText.includes('عرض التفاصيل والأرباح'));
        if (btn) {
          btn.click();
          break;
        }
      }
    });
    await sleep(1200);
    await captureBoth('owner-profit-drilldown');

    console.log('--- ALL SCREENSHOTS SUCCESSFULLY CAPTURED ---');
  } catch (err) {
    console.error('Error during screenshot capture:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
