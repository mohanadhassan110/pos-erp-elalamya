const { execSync } = require('child_process');

const terms = [
  'معرض الأمل',
  'النساجون',
  'المحلة',
  'النور',
  'السعادة',
  'الفردوس',
  'السلام',
  'الأثاث',
  'موبيليا',
  'furniture',
  'ستائر'
];

console.log('=== REPO-WIDE FORBIDDEN NAME / TERM AUDIT ===');
for (const term of terms) {
  console.log(`\n>>> SEARCH: "${term}" <<<`);
  try {
    const res = execSync(`git grep -n -I "${term}"`, { cwd: 'd:/elalamya-main', encoding: 'utf8' });
    console.log(res.trim());
  } catch (err) {
    if (err.status === 1) {
      console.log('(0 matches found)');
    } else {
      console.error(err.message);
    }
  }
}

console.log('\n=== SPECIFIC FILE INSPECTIONS ===');
const specificFiles = [
  'frontend/src/features/suppliers/SuppliersPage.tsx',
  'frontend/src/features/stock-receiving/StockReceivingPage.tsx',
  'frontend/src/features/customers/CustomersPage.tsx',
  'backend/tests/Feature/Api/V1/SalesReturnTest.php',
  'frontend/src/__tests__/salesReturns.test.ts'
];

for (const file of specificFiles) {
  console.log(`\n--- Inspecting: ${file} ---`);
  for (const term of terms) {
    try {
      const res = execSync(`git grep -n -I "${term}" -- "${file}"`, { cwd: 'd:/elalamya-main', encoding: 'utf8' });
      console.log(`[MATCH for "${term}"]: ${res.trim()}`);
    } catch (err) {
      // 0 match
    }
  }
  console.log(`(Checked all terms on ${file})`);
}
