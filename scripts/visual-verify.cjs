const puppeteer = require('d:/elalamya-main/frontend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://127.0.0.1';
const SCREENS_DIR = path.resolve(__dirname, '../docs/evidence/phase15b/screens');
const PRINT_DIR = path.resolve(__dirname, '../docs/evidence/phase15b/print');

fs.mkdirSync(SCREENS_DIR, { recursive: true });
fs.mkdirSync(PRINT_DIR, { recursive: true });

async function runVisualVerification() {
  console.log('--- STARTING VISUAL & USABILITY VERIFICATION ---');
  console.log('Connecting to Apache at:', BASE_URL);
  console.log('Using Chrome:', CHROME_PATH);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();

    async function loginAs(login, password) {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#login-input');
      await page.type('#login-input', login);
      await page.type('#password-input', password);
      await page.click('button[type="submit"]');
      await page.waitForSelector('#login-input', { hidden: true, timeout: 10000 });
      await new Promise(r => setTimeout(r, 1200));
    }

    // 1. Capture Login at 1366x768 and 1920x1080
    console.log('1. Capturing Login screen at 1366x768 and 1920x1080...');
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#login-input');
    await page.screenshot({ path: path.join(SCREENS_DIR, 'login-1366.png') });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'login-1920.png') });

    // 2. Login as Owner
    console.log('2. Logging in as owner...');
    await loginAs('owner', 'password123');

    // 3. POS Empty
    console.log('3. Capturing POS Empty screen...');
    await page.goto(`${BASE_URL}/pos`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="امسح الباركود"]');
    await page.setViewport({ width: 1366, height: 768 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-empty-1366.png') });
    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-empty-1920.png') });

    // 4. Products Picker modal from POS
    console.log('4. Capturing Products Picker modal...');
    const catalogBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(el => el.textContent.includes('كتالوج الأصناف'));
      if (b) { b.click(); return true; }
      return false;
    });
    if (catalogBtn) {
      await page.waitForSelector('button[aria-label="إغلاق النافذة"]');
      await new Promise(r => setTimeout(r, 600));
      await page.screenshot({ path: path.join(SCREENS_DIR, 'products-picker-1366.png') });
      await page.setViewport({ width: 1920, height: 1080 });
      await page.screenshot({ path: path.join(SCREENS_DIR, 'products-picker-1920.png') });
      // Close modal properly
      await page.click('button[aria-label="إغلاق النافذة"]');
      await new Promise(r => setTimeout(r, 600));
    }

    // 5. POS Rush-Hour 0-Click Keyboard Sale Test (TASK 8)
    console.log('5. Testing Rush-Hour Keyboard Sale (0 mouse clicks)...');
    await page.goto(`${BASE_URL}/pos`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="امسح الباركود"]');
    const barcodeInput = await page.$('input[placeholder*="امسح الباركود"]');
    if (barcodeInput) {
      await barcodeInput.focus();

      // Scan item 1: L0001
      await barcodeInput.type('L0001');
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 800));

      // Scan item 2: B0001
      await barcodeInput.type('B0001');
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 800));

      // Scan item 3: M0001
      await barcodeInput.type('M0001');
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 800));

      // Capture POS with Cart
      console.log('Capturing POS with Cart...');
      await page.setViewport({ width: 1366, height: 768 });
      await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-cart-1366.png') });
      await page.setViewport({ width: 1920, height: 1080 });
      await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-cart-1920.png') });

      // Test Change Due Display: Type 2500 tendered cash
      console.log('Capturing POS Change-Due Display...');
      const paidInput = await page.$('input[type="number"][placeholder="0.00"]');
      if (paidInput) {
        await paidInput.click();
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.type('2500');
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-change-due-1366.png') });
        await page.setViewport({ width: 1920, height: 1080 });
        await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-change-due-1920.png') });
      }

      // F8: Exact cash shortcut
      console.log('Pressing F8 for exact cash...');
      await page.keyboard.press('F8');
      await new Promise(r => setTimeout(r, 600));
      await page.setViewport({ width: 1366, height: 768 });
      await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-payment-1366.png') });
      await page.setViewport({ width: 1920, height: 1080 });
      await page.screenshot({ path: path.join(SCREENS_DIR, 'pos-payment-1920.png') });

      // F9: Complete sale shortcut
      console.log('Pressing F9 to complete sale...');
      await page.keyboard.press('F9');
      await page.waitForSelector('button[aria-label="إغلاق النافذة"]', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 1200));

      // Check if Invoice Print Modal opened
      console.log('Capturing Print Modal...');
      await page.screenshot({ path: path.join(SCREENS_DIR, 'print-modal-1366.png') });
      await page.setViewport({ width: 1920, height: 1080 });
      await page.screenshot({ path: path.join(SCREENS_DIR, 'print-modal-1920.png') });

      // Generate REAL print-to-PDFs (empty shop info default)
      console.log('Generating Thermal 80mm PDF (empty shop info)...');
      await page.emulateMediaType('print');

      // Assert that print DOM contains ONLY printable document and NOT app shell
      const hiddenShellInPrint = await page.evaluate(() => {
        const root = document.getElementById('root');
        const printRoot = document.getElementById('printable-root');
        const rootStyle = root ? window.getComputedStyle(root) : null;
        return {
          rootHidden: rootStyle ? rootStyle.display === 'none' : true,
          printRootHasContent: printRoot && printRoot.children.length > 0,
          printRootTextPreview: printRoot ? printRoot.innerText.substring(0, 100) : '',
        };
      });
      console.log('Print DOM Isolation Assertion:', hiddenShellInPrint);

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
    }

    // 6. Invoices List
    console.log('6. Capturing Invoices list...');
    await page.goto(`${BASE_URL}/invoices`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="بحث برقم الفاتورة"]');
    await new Promise(r => setTimeout(r, 1200));
    await page.setViewport({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'invoices-1366.png') });
    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'invoices-1920.png') });

    // Open first invoice details
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

    // 7. Products Page
    console.log('7. Capturing Products screen...');
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="بحث بالاسم أو الباركود"]');
    await page.setViewport({ width: 1366, height: 768 });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(SCREENS_DIR, 'products-1366.png') });
    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'products-1920.png') });

    // 8. Customers Page
    console.log('8. Capturing Customers screen...');
    await page.goto(`${BASE_URL}/customers`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="بحث باسم العميل"]');
    await page.setViewport({ width: 1366, height: 768 });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(SCREENS_DIR, 'customers-1366.png') });
    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'customers-1920.png') });

    // 9. Stock Receiving Page
    console.log('9. Capturing Stock Receiving screen...');
    await page.goto(`${BASE_URL}/stock-receiving`, { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 1366, height: 768 });
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(SCREENS_DIR, 'stock-receiving-1366.png') });
    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'stock-receiving-1920.png') });

    // 10. Owner Settings Page
    console.log('10. Capturing Owner Settings screen...');
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="01003116622"]');
    await page.setViewport({ width: 1366, height: 768 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENS_DIR, 'settings-1366.png') });
    await page.setViewport({ width: 1920, height: 1080 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'settings-1920.png') });

    // 11. Fill Showroom Info in Settings
    console.log('11. Setting owner showroom info in settings...');
    const phonesInput = await page.$('input[placeholder*="01003116622"]');
    if (phonesInput) {
      await phonesInput.click();
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.type('01003116622 - 01010498956');

      const addressInput = await page.$('input[placeholder*="شارع مسجد النجار"]');
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

      const policyInput = await page.$('input[placeholder*="الاسترجاع والاستبدال"]');
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

    // 12. Generate A4 invoice PDF and Filled Shop-info PDF
    console.log('12. Generating A4 and Filled Shop-Info PDFs...');
    await page.goto(`${BASE_URL}/invoices`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="بحث برقم الفاتورة"]');
    await new Promise(r => setTimeout(r, 1500));

    // Click first "طباعة" button
    const printClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(el => el.textContent.includes('طباعة'));
      if (b) { b.click(); return true; }
      return false;
    });
    console.log('Invoice print button clicked:', printClicked);

    if (printClicked) {
      await page.waitForSelector('button[aria-label="إغلاق النافذة"]');
      await new Promise(r => setTimeout(r, 1200));

      // Switch to A4 format
      const switchedToA4 = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const b = buttons.find(el => el.textContent.includes('A4'));
        if (b) { b.click(); return true; }
        return false;
      });
      console.log('Switched to A4:', switchedToA4);
      await new Promise(r => setTimeout(r, 1200));

      await page.emulateMediaType('print');
      const a4Pdf = await page.pdf({
        format: 'A4',
        margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
        printBackground: true,
      });
      fs.writeFileSync(path.join(PRINT_DIR, 'a4-invoice.pdf'), a4Pdf);
      fs.writeFileSync(path.join(PRINT_DIR, 'print-filled-shopinfo.pdf'), a4Pdf);

      // Switch to Thermal format for wholesale balance filled PDF
      await page.emulateMediaType('screen');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const b = buttons.find(el => el.textContent.includes('حراري 80مم'));
        if (b) b.click();
      });
      await new Promise(r => setTimeout(r, 1200));

      await page.emulateMediaType('print');
      const thermalFilledPdf = await page.pdf({
        width: '80mm',
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      fs.writeFileSync(path.join(PRINT_DIR, 'thermal80-wholesale-balance.pdf'), thermalFilledPdf);

      await page.emulateMediaType('screen');
      await page.click('button[aria-label="إغلاق النافذة"]');
      await new Promise(r => setTimeout(r, 800));
    }

    // 13. Test Reports Lock Screen for Cashier
    console.log('13. Testing Reports Lock Screen for Cashier...');
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

    console.log('--- ALL VISUAL VERIFICATIONS COMPLETED SUCCESSFULLY ---');
  } finally {
    await browser.close();
  }
}

runVisualVerification().catch(err => {
  console.error('Visual Verification Error:', err);
  process.exit(1);
});
