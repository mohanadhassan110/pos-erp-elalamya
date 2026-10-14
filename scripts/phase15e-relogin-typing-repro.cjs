// Phase 15-E observation (pre-existing, reproduced on c7a4028 too): after owner -> cashier re-login in the same tab,
// keystrokes typed into the invoices search box are lost. Not fixed in this phase.
const puppeteer = require('d:/elalamya-main/frontend/node_modules/puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text().slice(0, 150)));
  const login = async (u) => {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#login-input');
    await page.type('#login-input', u);
    await page.type('#password-input', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#login-input', { hidden: true, timeout: 15000 });
    await sleep(1000);
  };
  const trySearch = async (label) => {
    await page.goto('http://localhost:5173/invoices', { waitUntil: 'networkidle0' });
    await sleep(1500);
    const sel = 'input[placeholder^="بحث برقم الفاتورة"]';
    await page.type(sel, 'INV-20261011-0005', { delay: 20 });
    console.log(label, JSON.stringify(await page.$eval(sel, (e) => e.value)), 'url', page.url());
  };
  await login('owner');
  await trySearch('owner');
  await login('cashier');
  await trySearch('cashier-after-owner');
  await browser.close();
})();
