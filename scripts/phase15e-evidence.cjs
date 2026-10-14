/**
 * Phase 15-E evidence capture: barcode page styling + returns inside invoices.
 * Runs headless Chrome against the Vite dev server (http://localhost:5173, proxying /api to :8000).
 * NOTE: creates real return records (an exchange_upgrade and a full refund) in the local test database.
 */
const puppeteer = require('d:/elalamya-main/frontend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUT_DIR = path.resolve(__dirname, '../docs/evidence/phase-15e');
const SCREENS_DIR = path.join(OUT_DIR, 'screens');
const RAW_DIR = path.join(OUT_DIR, 'raw');
fs.mkdirSync(SCREENS_DIR, { recursive: true });
fs.mkdirSync(RAW_DIR, { recursive: true });

const LOG_NAME = process.env.CASHIER_ONLY ? 'evidence-run-2-cashier.log' : 'evidence-run.log';
const logLines = [];
const log = (...args) => {
  const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(line);
  logLines.push(line);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  log(`--- PHASE 15-E EVIDENCE RUN ${new Date().toISOString()} against ${BASE_URL} ---`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--lang=ar'],
  });
  let page = await browser.newPage();
  page.on('pageerror', (e) => log('[pageerror]', e.message));

  const shot = async (name) => {
    await page.screenshot({ path: path.join(SCREENS_DIR, name) });
    log(`saved screens/${name}`);
  };
  // Capture the current UI state at 1920×1080 and 1366×768 (state is kept across resizes).
  const captureBoth = async (base, before) => {
    for (const [w, h] of [[1920, 1080], [1366, 768]]) {
      await page.setViewport({ width: w, height: h });
      await sleep(500);
      if (before) await before();
      await sleep(300);
      await shot(`${base}-${w}.png`);
    }
  };
  const waitText = (text, timeout = 10000) =>
    page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
  const clickText = (selector, text) =>
    page.evaluate((s, t) => {
      const el = [...document.querySelectorAll(s)].find((e) => e.innerText.includes(t) && !e.disabled);
      if (!el) throw new Error(`clickable "${t}" not found in ${s}`);
      el.click();
    }, selector, text);
  const api = (p) =>
    page.evaluate(async (p) => {
      const token = localStorage.getItem('elalamya_auth_token');
      const r = await fetch(`/api/v1${p}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
      return { status: r.status, body: await r.json() };
    }, p);
  const scrollDialog = (top) =>
    page.evaluate((t) => {
      const body = document.querySelector('[role=dialog] > div:nth-child(2)');
      if (body) body.scrollTop = t === 'end' ? body.scrollHeight : t;
    }, top);

  async function login(username) {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#login-input');
    await page.type('#login-input', username);
    await page.type('#password-input', 'password123'); // seeded local test credentials (DatabaseSeeder)
    await page.click('button[type="submit"]');
    await page.waitForSelector('#login-input', { hidden: true, timeout: 15000 });
    await sleep(1000);
    log(`logged in as ${username}`);
  }

  async function openInvoiceDetails(invoiceNumber) {
    await page.goto(`${BASE_URL}/invoices`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder^="بحث برقم الفاتورة"]');
    await sleep(1500); // let the app shell finish its post-load re-render before typing
    await page.type('input[placeholder^="بحث برقم الفاتورة"]', invoiceNumber, { delay: 20 });
    await page
      .waitForFunction(
        (n) => {
          const rows = document.querySelectorAll('tbody tr');
          return rows.length >= 1 && rows[0].innerText.includes(n);
        },
        { timeout: 10000 },
        invoiceNumber
      )
      .catch(async (e) => {
        log('search diagnostics', await page.evaluate(() => ({
          value: document.querySelector('input[placeholder^="بحث برقم الفاتورة"]')?.value,
          active: document.activeElement?.tagName + ':' + document.activeElement?.getAttribute('placeholder'),
          rows: [...document.querySelectorAll('tbody tr')].map((r) => r.innerText.slice(0, 25)),
        })));
        throw e;
      });
    await clickText('button', 'التفاصيل');
    await page.waitForSelector('[data-testid="invoice-return-action"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="invoice-return-action"]').innerHTML.includes('spin'), { timeout: 10000 });
    await sleep(500);
  }

  // ------------------------------------------------------------------ OWNER
  await login('owner');

  // Pick evidence invoices from real data
  const list = await api('/invoices?per_page=50&status=posted');
  const candidates = list.body.data.filter((i) => !i.is_replacement);
  const exchangeTarget = candidates.find((i) => i.invoice_number === 'INV-20261011-0005') || candidates[0];
  const refundTarget = candidates.find((i) => i.id !== exchangeTarget.id && !i.has_returns && parseFloat(i.total) < 1000);
  const mockTarget = candidates.find((i) => i.id !== exchangeTarget.id && i.id !== refundTarget?.id);
  log('exchange target', exchangeTarget.invoice_number, 'refund target', refundTarget?.invoice_number, 'mock target', mockTarget?.invoice_number);

  if (!process.env.CASHIER_ONLY) {
  // 1. Barcodes — empty state
  await page.goto(`${BASE_URL}/barcodes`, { waitUntil: 'networkidle0' });
  await waitText('طباعة ملصقات الباركود');
  await captureBoth('01-barcodes-empty');
  const tailwindCheck = await page.evaluate(() => {
    const grid = document.querySelector('.barcode-workspace-grid');
    return { gridDisplay: grid && getComputedStyle(grid).display, gridColumns: grid && getComputedStyle(grid).gridTemplateColumns, docScrollWidth: document.documentElement.scrollWidth, viewport: window.innerWidth };
  });
  log('barcode layout (1366)', tailwindCheck);

  // 2. Three products, thermal format
  await page.setViewport({ width: 1920, height: 1080 });
  const search = 'input[aria-label="بحث عن صنف لإضافته"]';
  for (const term of ['لحاف', 'بطانية', 'فوط']) {
    await page.type(search, term);
    await page.waitForSelector('[role=listbox] button', { timeout: 8000 });
    await page.keyboard.press('Enter');
    await sleep(500);
  }
  await page.waitForFunction(() => document.body.innerText.includes('3 صنف'), { timeout: 8000 });
  await sleep(1500);
  await captureBoth('02-barcodes-thermal-3-products');

  // 3. A4 4-column format
  await page.click('input[value="a4-4x8"]');
  await sleep(800);
  await captureBoth('03-barcodes-a4-4col');

  // 4. Print output: print-media emulation screenshot + PDFs (Chrome's print engine with @page sizes)
  const pdfSizes = async (file) => {
    const buf = fs.readFileSync(file).toString('latin1');
    const boxes = [...buf.matchAll(/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g)].map((m) => `${(m[1] * 25.4 / 72).toFixed(1)}x${(m[2] * 25.4 / 72).toFixed(1)}mm`);
    return { pages: boxes.length, sizes: [...new Set(boxes)] };
  };
  await page.click('input[value="a4-4x8"]');
  await sleep(500);
  const a4Pdf = path.join(OUT_DIR, '04b-print-a4-4col.pdf');
  await page.pdf({ path: a4Pdf, preferCSSPageSize: true, printBackground: true });
  log('A4 4-col PDF', await pdfSizes(a4Pdf));

  await page.click('input[value="thermal-50x25"]');
  await sleep(800);
  const thermalPdf = path.join(OUT_DIR, '04-print-thermal-50x25.pdf');
  await page.pdf({ path: thermalPdf, preferCSSPageSize: true, printBackground: true });
  log('thermal 50x25 PDF', await pdfSizes(thermalPdf));

  await page.click('input[value="thermal-38x25"]');
  await sleep(800);
  const thermal38Pdf = path.join(OUT_DIR, '04c-print-thermal-38x25.pdf');
  await page.pdf({ path: thermal38Pdf, preferCSSPageSize: true, printBackground: true });
  log('thermal 38x25 PDF', await pdfSizes(thermal38Pdf));

  await page.click('input[value="thermal-50x25"]');
  await sleep(500);
  await page.setViewport({ width: 600, height: 500 });
  await page.emulateMediaType('print');
  await sleep(500);
  await page.screenshot({ path: path.join(SCREENS_DIR, '04-print-media-thermal-labels.png'), fullPage: true });
  log('saved screens/04-print-media-thermal-labels.png (print media emulation, not the OS print dialog)');
  await page.emulateMediaType(null);

  // 5. Invoice details with the return button
  await openInvoiceDetails(exchangeTarget.invoice_number);
  log('return button disabled?', await page.$eval('[data-testid="invoice-return-action"]', (b) => b.disabled));
  await captureBoth('05-invoice-details-return-button');

  // 6. Flow pre-loaded from the invoice
  await page.click('[data-testid="invoice-return-action"]');
  await waitText('الأصناف المتاحة للإرجاع');
  await sleep(500);
  log('flow title', await page.$eval('[role=dialog]', (d) => d.innerText.split('\n')[0]));
  log('focused element on open', await page.evaluate(() => document.activeElement?.getAttribute('aria-label')));
  log('invoice-number search field present in pre-loaded flow?', await page.evaluate(() => document.body.innerText.includes('رقم الفاتورة الأصلية')));
  await captureBoth('06-return-flow-preloaded', () => scrollDialog(0));

  // 7. exchange_upgrade, keyboard-driven where possible
  await page.keyboard.type('1'); // focused first quantity input
  await page.click('input[value="exchange_upgrade"]');
  const replacementInput = 'input[placeholder^="ابحث عن الصنف البديل"]';
  await page.waitForSelector(replacementInput);
  await page.focus(replacementInput);
  await page.keyboard.type('بطانية');
  await page.keyboard.press('Enter');
  await waitText('نتائج البحث');
  await page.focus('[role=dialog] button[type=button][style*="text-align: right"]');
  await page.keyboard.press('Enter'); // add first replacement result with the keyboard
  await waitText('الفارق المطلوب تحصيله');
  await page.focus('#cashier-confirm-checkbox');
  await page.keyboard.press('Space');
  await sleep(400);
  const summary = await page.evaluate(() => {
    const t = document.querySelector('[role=dialog]').innerText;
    return t.slice(t.indexOf('الملخص المالي'), t.indexOf('أؤكد'));
  });
  log('exchange summary before submit:', summary.replace(/\n/g, ' | '));
  await captureBoth('07-exchange-upgrade-before-submit', () => scrollDialog('end'));

  await clickText('[role=dialog] button', 'تأكيد وتنفيذ عملية المرتجع');
  await waitText('تم تسجيل المرتجع', 15000);
  await sleep(800);
  const successText = await page.$eval('[role=status]', (e) => e.innerText);
  log('success banner:', successText.replace(/\n/g, ' | '));
  await captureBoth('07b-exchange-success-replacement-link', () => scrollDialog(0));

  // Esc closes the flow and returns to the refreshed invoice details
  await page.keyboard.press('Escape');
  await sleep(1500);
  const afterReturn = await page.$eval('[role=dialog]', (d) => d.innerText);
  log('after Esc: dialog is invoice details?', afterReturn.startsWith('تفاصيل الفاتورة'), '| shows return banner?', afterReturn.includes('قيمة المرتجع'), '| net after returns shown?', afterReturn.includes('الصافي بعد المرتجع'));
  await captureBoth('07c-invoice-details-refreshed-after-return');
  await page.keyboard.press('Escape');
  await sleep(500);

  // 9a. Fully return a second invoice via toolbar "فاتورة مرتجع" (keyboard: type number + Enter)
  if (refundTarget) {
    await page.goto(`${BASE_URL}/invoices`, { waitUntil: 'networkidle0' });
    await clickText('button', 'فاتورة مرتجع');
    await page.waitForSelector('[role=dialog] input[placeholder^="مثال: INV"]');
    log('toolbar flow focused element', await page.evaluate(() => document.activeElement?.getAttribute('placeholder')));
    await page.keyboard.type(refundTarget.invoice_number);
    await captureBoth('08a-toolbar-return-invoice-search');
    await page.keyboard.press('Enter');
    await waitText('الأصناف المتاحة للإرجاع');
    const qtyInputs = await page.$$('[role=dialog] input[type=number][aria-label^="الكمية المرتجعة"]');
    for (const input of qtyInputs) {
      const max = await input.evaluate((el) => el.max);
      await input.type(String(max));
    }
    await page.focus('#cashier-confirm-checkbox');
    await page.keyboard.press('Space');
    await clickText('[role=dialog] button', 'تأكيد وتنفيذ عملية المرتجع');
    await waitText('تم تسجيل المرتجع', 15000);
    await sleep(800);
    log('full refund success:', (await page.$eval('[role=status]', (e) => e.innerText)).replace(/\n/g, ' | '));
    log('flow now shows blocked reason?', await page.evaluate(() => document.body.innerText.includes('تم إرجاع جميع أصناف هذه الفاتورة بالكامل')));
    await page.keyboard.press('Escape');
    await sleep(500);
    log('Esc closed toolbar flow?', !(await page.$('[role=dialog]')));

    await openInvoiceDetails(refundTarget.invoice_number);
    log('fully returned: button disabled?', await page.$eval('[data-testid="invoice-return-action"]', (b) => b.disabled), '| reason:', await page.$eval('[data-testid="invoice-return-blocked-reason"]', (e) => e.innerText));
    await captureBoth('09-fully-returned-invoice-button-disabled');
    await page.keyboard.press('Escape');
  }

  // 9b. Cancelled invoice — MOCKED response (no cancel endpoint exists in the backend; DB has 0 cancelled invoices)
  if (mockTarget) {
    await page.setRequestInterception(true);
    const handler = async (req) => {
      const url = req.url();
      const isTarget = url.endsWith(`/api/v1/invoices/${mockTarget.id}`) || url.endsWith(`/api/v1/returns/invoice/${mockTarget.id}`);
      if (!isTarget || req.method() !== 'GET') return req.continue();
      const headers = { ...req.headers() };
      const res = await fetch(url, { headers });
      const json = await res.json();
      json.data.status = 'cancelled';
      json.data.status_label = 'ملغاة';
      req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
    };
    page.on('request', handler);
    await openInvoiceDetails(mockTarget.invoice_number);
    log('MOCKED cancelled: button disabled?', await page.$eval('[data-testid="invoice-return-action"]', (b) => b.disabled), '| reason:', await page.$eval('[data-testid="invoice-return-blocked-reason"]', (e) => e.innerText));
    await captureBoth('09b-cancelled-invoice-MOCKED-response');
    page.off('request', handler);
    await page.setRequestInterception(false);
    await page.keyboard.press('Escape');
  }

  // 8. Returns tab
  await page.goto(`${BASE_URL}/invoices?tab=returns`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length >= 2, { timeout: 10000 });
  log('returns tab rows', await page.$$eval('tbody tr', (rows) => rows.length), '| table fits (scrollWidth<=clientWidth)?', await page.$eval('table', (t) => t.scrollWidth <= t.parentElement.clientWidth + 1));
  await captureBoth('08-invoices-returns-tab');

  // Return details modal from the returns tab
  await clickText('tbody button', 'عرض');
  await waitText('تفاصيل المرتجع');
  await captureBoth('08b-return-details-modal');
  await page.keyboard.press('Escape');

  // 10. Sidebar
  log('sidebar links', await page.$$eval('aside a, nav a', (as) => as.map((a) => `${a.getAttribute('href')}=${a.innerText.trim()}`)));
  log('sidebar contains /returns link?', await page.$$eval('a', (as) => as.some((a) => a.getAttribute('href') === '/returns')));
  await captureBoth('10-sidebar-after-removal');

  // /returns redirect
  await page.goto(`${BASE_URL}/returns`, { waitUntil: 'networkidle0' });
  await sleep(800);
  log('/returns redirected to', page.url().replace(BASE_URL, ''), '| returns tab selected?', await page.$eval('[role=tab][aria-selected=true]', (t) => t.innerText));

  } // end owner section

  // ------------------------------------------------------------------ CASHIER
  // Fresh browser context for the cashier (separate workstation); see raw/relogin-typing-repro-*.log
  const cashierContext = await browser.createBrowserContext();
  page = await cashierContext.newPage();
  page.on('pageerror', (e) => log('[pageerror]', e.message));
  await login('cashier');
  const forbidden = /تكلفة|التكلفة|ربح|الربح|أرباح|صنف خارجي|unit_cost|profit/;
  await openInvoiceDetails(exchangeTarget.invoice_number);
  let text = await page.$eval('[role=dialog]', (d) => d.innerText);
  log('CASHIER invoice details: return button disabled?', await page.$eval('[data-testid="invoice-return-action"]', (b) => b.disabled), '| forbidden terms present?', forbidden.test(text));
  await captureBoth('11a-cashier-invoice-details');

  await page.$eval('[data-testid="invoice-return-action"]', (b) => b.click());
  await waitText('الأصناف المتاحة للإرجاع');
  text = await page.$eval('[role=dialog]', (d) => d.innerText);
  log('CASHIER return flow: forbidden terms present?', forbidden.test(text));
  await captureBoth('11b-cashier-return-flow', () => scrollDialog(0));
  await page.keyboard.press('Escape');
  await sleep(300);
  await page.keyboard.press('Escape');

  await page.goto(`${BASE_URL}/invoices?tab=returns`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length >= 2, { timeout: 10000 });
  text = await page.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText);
  log('CASHIER returns tab: forbidden terms present?', forbidden.test(text));
  await captureBoth('11c-cashier-returns-tab');

  // Raw API payload check for the cashier role (backend unchanged in this phase)
  const cashierReturns = await api('/returns?per_page=5');
  const cashierReturnable = await api(`/returns/invoice/${exchangeTarget.id}`);
  const keysOf = (o) => JSON.stringify(o).match(/"(unit_cost|profit[a-z_]*|total_profit[a-z_]*|item_type)"/g) || [];
  log('CASHIER GET /returns cost/profit keys:', [...new Set(keysOf(cashierReturns.body))]);
  log('CASHIER GET /returns/invoice/{id} cost/profit/type keys:', [...new Set(keysOf(cashierReturnable.body))]);

  await browser.close();
  fs.writeFileSync(path.join(RAW_DIR, LOG_NAME), logLines.join('\n') + '\n');
  log('--- DONE ---');
}

run().catch((e) => {
  log('FATAL', e.stack || e.message);
  fs.writeFileSync(path.join(RAW_DIR, LOG_NAME), logLines.join('\n') + '\n');
  process.exit(1);
});
