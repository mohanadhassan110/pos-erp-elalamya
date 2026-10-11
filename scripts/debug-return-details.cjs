const puppeteer = require('d:/elalamya-main/frontend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://127.0.0.1';
const SCREENS_DIR = path.resolve(__dirname, '../docs/evidence/phase15d/screens');

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.type('#login-input', 'owner');
    await page.type('#password-input', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#login-input', { hidden: true });
    await new Promise(r => setTimeout(r, 1200));

    await page.goto(`${BASE_URL}/returns`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    // Click 'سجل المرتجعات السابقة'
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const histTab = tabs.find(b => b.innerText.includes('سجل المرتجعات السابقة'));
      if (histTab) histTab.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    console.log('Clicking button...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const showBtn = btns.find(b => b.innerText.trim() === 'عرض');
      if (showBtn) {
        console.log('Found show button, clicking');
        showBtn.click();
      } else {
        console.log('Button not found');
      }
    });
    await new Promise(r => setTimeout(r, 1500));

    await page.setViewport({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'return-details-modal-1366.png') });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'return-details-modal-1920.png') });

    console.log('Screenshots taken');
  } finally {
    await browser.close();
  }
}

run();
