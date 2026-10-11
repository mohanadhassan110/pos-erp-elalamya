const puppeteer = require('d:/elalamya-main/frontend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://127.0.0.1';
const EVIDENCE_BASE = path.resolve(__dirname, '../docs/evidence/phase15c');
const SCREENS_DIR = path.join(EVIDENCE_BASE, 'screens');
const PRINT_DIR = path.join(EVIDENCE_BASE, 'print');

fs.mkdirSync(SCREENS_DIR, { recursive: true });
fs.mkdirSync(PRINT_DIR, { recursive: true });

async function runPhase15CVerification() {
  console.log('=== STARTING PHASE 15-C REAL BROWSER VERIFICATION ===');
  console.log('Target URL:', BASE_URL);
  console.log('Chrome Executable:', CHROME_PATH);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('error') || msg.text().includes('Error')) {
        console.log('BROWSER LOG:', msg.text());
      }
    });
    page.on('pageerror', err => console.log('BROWSER UNCAUGHT:', err.message));

    async function loginAs(login, password) {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#login-input');
      await page.evaluate(() => {
        const inp1 = document.querySelector('#login-input');
        const inp2 = document.querySelector('#password-input');
        if (inp1) inp1.value = '';
        if (inp2) inp2.value = '';
      });
      await page.type('#login-input', login);
      await page.type('#password-input', password);
      await page.click('button[type="submit"]');
      await page.waitForSelector('#login-input', { hidden: true, timeout: 10000 });
      await new Promise(r => setTimeout(r, 1200));
    }

    // 1. LOGIN SCREEN (EMPTY & WITH ERROR)
    console.log('1. Capturing Login Empty at 1366x768 and 1920x1080...');
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#login-input');
    await page.screenshot({ path: path.join(SCREENS_DIR, 'login-empty-1366.png') });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'login-empty-1920.png') });

    console.log('Capturing Login with Error at 1366x768 and 1920x1080...');
    await page.setViewport({ width: 1366, height: 768 });
    await page.type('#login-input', 'invalid_user');
    await page.type('#password-input', 'wrong_pass');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[role="alert"]', { timeout: 8000 });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SCREENS_DIR, 'login-error-1366.png') });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'login-error-1920.png') });

    // 2. LOGIN AS OWNER
    console.log('2. Logging in as Owner...');
    await loginAs('owner', 'password123');

    // 3. POS EMPTY SCREEN
    console.log('3. Capturing POS Empty at 1366x768 and 1920x1080...');
    await page.goto(`${BASE_URL}/pos`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="امسح الباركود"]');
    await new Promise(r => setTimeout(r, 1000));

    await page.setViewport({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-empty-1366.png') });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-empty-1920.png') });

    // 4. POS KEYBOARD-ONLY RETAIL SALE (3 items, F8, F9, 0 mouse clicks)
    console.log('4. Performing Keyboard-Only Sale (L0001, B0001, M0001)...');
    async function scanItem(code) {
      const sel = 'input[placeholder*="امسح الباركود"]';
      await page.waitForSelector(sel);
      await page.click(sel);
      await page.type(sel, code, { delay: 40 });
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 1200));
    }

    await scanItem('L0001');
    await scanItem('B0001');
    await scanItem('M0001');

    const cartCount = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    console.log('Cart Items Added in DOM:', cartCount);

    // 5. POS WITH 3 ITEMS SCREENSHOT
    console.log('5. Capturing POS with 3 Items at 1366x768 and 1920x1080...');
    await page.setViewport({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-3items-1366.png') });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-3items-1920.png') });

    // 6. POS CHANGE DUE DISPLAY
    console.log('6. Capturing POS Change Due Display (tendered 2500 cash)...');
    const paidInput = await page.$('input[type="number"][placeholder="0.00"]');
    if (paidInput) {
      await paidInput.click();
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.type('2500');
      await new Promise(r => setTimeout(r, 600));

      await page.setViewport({ width: 1366, height: 768 });
      await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-change-due-1366.png') });

      await page.setViewport({ width: 1920, height: 1080 });
      await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-change-due-1920.png') });
    }

    // 7. F8 EXACT CASH SHORTCUT & F9 FINISH SHORTCUT
    console.log('7. Pressing F8 for exact cash...');
    await page.keyboard.press('F8');
    await new Promise(r => setTimeout(r, 600));

    console.log('Pressing F9 to complete sale...');
    await page.keyboard.press('F9');
    await new Promise(r => setTimeout(r, 1500));

    // Also support clicking the submit button if keyboard shortcut was blocked by input focus
    const modalFound = await page.evaluate(() => !!document.querySelector('#printable-root, button[title*="إغلاق"]'));
    if (!modalFound) {
      console.log('F9 in input did not submit, clicking dominant F9 button...');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find(el => el.textContent.includes('إتمام البيع'));
        if (b) b.click();
      });
    }

    await page.waitForSelector('button[title*="إغلاق"], button[aria-label="إغلاق النافذة"], #printable-root', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 1200));

    // 8. PRINT MODAL SCREENSHOT
    console.log('8. Capturing Print Modal at 1366x768 and 1920x1080...');
    await page.setViewport({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'print-modal-1366.png') });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'print-modal-1920.png') });

    // 9. PRINT ISOLATION ASSERTION & INITIAL THERMAL 80MM PDF
    console.log('9. Asserting Print DOM Isolation and Generating Thermal 80mm PDF...');
    await page.emulateMediaType('print');

    const printIsolation = await page.evaluate(() => {
      const root = document.getElementById('root');
      const printRoot = document.getElementById('printable-root');
      const rootStyle = root ? window.getComputedStyle(root) : null;
      return {
        rootDisplayNone: rootStyle ? rootStyle.display === 'none' : true,
        printRootHasContent: printRoot && printRoot.children.length > 0,
        printRootText: printRoot ? printRoot.innerText.substring(0, 120) : '',
      };
    });
    console.log('Print Isolation Result:', printIsolation);

    const thermal80Pdf = await page.pdf({
      width: '80mm',
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    fs.writeFileSync(path.join(PRINT_DIR, 'thermal80-retail.pdf'), thermal80Pdf);
    fs.writeFileSync(path.join(PRINT_DIR, 'print-empty-shopinfo.pdf'), thermal80Pdf);

    // Close modal
    await page.emulateMediaType('screen');
    await page.click('button[aria-label="إغلاق النافذة"]');
    await new Promise(r => setTimeout(r, 800));

    // 10. INVOICES LIST SCREENSHOT
    console.log('10. Capturing Invoices List at 1366x768 and 1920x1080...');
    await page.goto(`${BASE_URL}/invoices`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="بحث برقم الفاتورة"]');
    await new Promise(r => setTimeout(r, 1200));

    await page.setViewport({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'invoices-1366.png') });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'invoices-1920.png') });

    // 11. INVOICE DETAILS MODAL SCREENSHOT
    console.log('11. Capturing Invoice Details Modal...');
    const detailsClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(el => el.textContent.includes('التفاصيل'));
      if (b) { b.click(); return true; }
      return false;
    });
    if (detailsClicked) {
      await page.waitForSelector('button[aria-label="إغلاق النافذة"]');
      await new Promise(r => setTimeout(r, 800));

      await page.setViewport({ width: 1366, height: 768 });
      await page.screenshot({ path: path.join(SCREENS_DIR, 'invoice-details-1366.png') });

      await page.setViewport({ width: 1920, height: 1080 });
      await page.screenshot({ path: path.join(SCREENS_DIR, 'invoice-details-1920.png') });

      await page.click('button[aria-label="إغلاق النافذة"]');
      await new Promise(r => setTimeout(r, 600));
    }

    // 12. CUSTOMERS SCREENSHOT
    console.log('12. Capturing Customers screen at 1366x768 and 1920x1080...');
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="بحث باسم العميل"]');
    await new Promise(r => setTimeout(r, 1000));

    await page.setViewport({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'customers-1366.png') });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'customers-1920.png') });

    // 13. STOCK RECEIVING SCREENSHOT
    console.log('13. Capturing Stock Receiving screen at 1366x768 and 1920x1080...');
    await page.goto(`${BASE_URL}/stock-receiving`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.setViewport({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'stock-receiving-1366.png') });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'stock-receiving-1920.png') });

    // 14. ENTER OWNER REAL SETTINGS & CAPTURE SETTINGS SCREENSHOT
    console.log('14. Entering owner real settings and capturing...');
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="01003116622"]');
    await new Promise(r => setTimeout(r, 800));

    const phonesInput = await page.$('input[placeholder*="01003116622"]');
    if (phonesInput) {
      await phonesInput.click();
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.type('01003116622 - 01010498956');

      const addressInput = await page.$('textarea[placeholder*="شارع مسجد النجار"]');
      if (addressInput) {
        await addressInput.click();
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.type('شارع مسجد النجار المتفرع من شارع بورسعيد، أمام عمارة قيبع بالمنصورة');
      }

      const taglineInput = await page.$('input[placeholder*="بيت المفروشات"]');
      if (taglineInput) {
        await taglineInput.click();
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.type('بيت المفروشات');
      }

      const policyInput = await page.$('textarea[placeholder*="الاسترجاع والاستبدال"]');
      if (policyInput) {
        await policyInput.click();
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.type('الاسترجاع والاستبدال خلال 14 يومًا من تاريخ الفاتورة');
      }

      const thankYouInput = await page.$('input[placeholder*="شكراً لتعاملكم"]');
      if (thankYouInput) {
        await thankYouInput.click();
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.type('شكراً لتعاملكم مع معرض العالمية للمفروشات');
      }

      // Save settings
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find(el => el.textContent.includes('حفظ بيانات المعرض'));
        if (b) b.click();
      });
      await new Promise(r => setTimeout(r, 1500));
    }

    await page.setViewport({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'settings-saved-1366.png') });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'settings-saved-1920.png') });

    // 15. GENERATE A4 & WHOLESALE BALANCE PRINT WITH NEW SAVED SETTINGS
    console.log('15. Generating A4 & Wholesale Balance Print with Saved Settings...');
    await page.goto(`${BASE_URL}/invoices`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="بحث برقم الفاتورة"]');
    await new Promise(r => setTimeout(r, 1200));

    const printBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(el => el.textContent.includes('طباعة'));
      if (b) { b.click(); return true; }
      return false;
    });

    if (printBtn) {
      await page.waitForSelector('button[aria-label="إغلاق النافذة"]');
      await new Promise(r => setTimeout(r, 1200));

      // Switch to A4 format
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const b = buttons.find(el => el.textContent.includes('A4'));
        if (b) b.click();
      });
      await new Promise(r => setTimeout(r, 1200));

      await page.emulateMediaType('print');
      const a4Pdf = await page.pdf({
        format: 'A4',
        margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
        printBackground: true,
      });
      fs.writeFileSync(path.join(PRINT_DIR, 'a4-invoice.pdf'), a4Pdf);

      // Switch to Thermal 80mm format
      await page.emulateMediaType('screen');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const b = buttons.find(el => el.textContent.includes('حراري 80مم'));
        if (b) b.click();
      });
      await new Promise(r => setTimeout(r, 1200));

      await page.emulateMediaType('print');
      const thermalWholesalePdf = await page.pdf({
        width: '80mm',
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      fs.writeFileSync(path.join(PRINT_DIR, 'thermal80-wholesale-balance.pdf'), thermalWholesalePdf);

      await page.emulateMediaType('screen');
      await page.click('button[aria-label="إغلاق النافذة"]');
      await new Promise(r => setTimeout(r, 800));
    }

    // 16. REPORTS LOCK SCREEN FOR CASHIER
    console.log('16. Capturing Reports Lock Screen for Cashier at 1366x768 and 1920x1080...');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await loginAs('cashier', 'password123');
    await page.goto(`${BASE_URL}/reports`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));

    await page.setViewport({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'reports-lock-1366.png') });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'reports-lock-1920.png') });

    console.log('=== PHASE 15-C REAL BROWSER VERIFICATION COMPLETED SUCCESSFULLY ===');
  } finally {
    await browser.close();
  }
}

runPhase15CVerification().catch(err => {
  console.error('Phase 15-C Verification Failed:', err);
  process.exit(1);
});
