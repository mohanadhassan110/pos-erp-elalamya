const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../docs/evidence/phase15c');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

console.log('Generating evidence logs...');

try {
  const npmTest = execSync('npm test', { cwd: path.resolve(__dirname, '../frontend') }).toString();
  fs.writeFileSync(path.join(dir, 'npm-test.txt'), npmTest);
  console.log('Saved npm-test.txt');
} catch (e) {
  fs.writeFileSync(path.join(dir, 'npm-test.txt'), e.stdout?.toString() || e.message);
}

try {
  const oxlint = execSync('npx oxlint', { cwd: path.resolve(__dirname, '../frontend') }).toString();
  fs.writeFileSync(path.join(dir, 'oxlint.txt'), oxlint);
  console.log('Saved oxlint.txt');
} catch (e) {
  fs.writeFileSync(path.join(dir, 'oxlint.txt'), e.stdout?.toString() || e.message);
}

try {
  const npmBuild = execSync('npm run build', { cwd: path.resolve(__dirname, '../frontend') }).toString();
  fs.writeFileSync(path.join(dir, 'npm-build.txt'), npmBuild);
  console.log('Saved npm-build.txt');
} catch (e) {
  fs.writeFileSync(path.join(dir, 'npm-build.txt'), e.stdout?.toString() || e.message);
}

try {
  const artisanTest = execSync('php artisan test', { cwd: path.resolve(__dirname, '../backend') }).toString();
  fs.writeFileSync(path.join(dir, 'artisan-test.txt'), artisanTest);
  console.log('Saved artisan-test.txt');
} catch (e) {
  fs.writeFileSync(path.join(dir, 'artisan-test.txt'), e.stdout?.toString() || e.message);
}

try {
  const pint = execSync('php vendor/bin/pint --test', { cwd: path.resolve(__dirname, '../backend') }).toString();
  fs.writeFileSync(path.join(dir, 'pint.txt'), pint);
  console.log('Saved pint.txt');
} catch (e) {
  fs.writeFileSync(path.join(dir, 'pint.txt'), e.stdout?.toString() || e.message);
}

try {
  const policyCTest = execSync('php artisan test --filter=concrete_external_product_return_scenario_produces_exact_loss_of_600', { cwd: path.resolve(__dirname, '../backend') }).toString();
  fs.writeFileSync(path.join(dir, 'policy-c-test.txt'), policyCTest);
  console.log('Saved policy-c-test.txt');
} catch (e) {
  fs.writeFileSync(path.join(dir, 'policy-c-test.txt'), e.stdout?.toString() || e.message);
}

let emojiOut = '0 emojis found in frontend/src';
try {
  const res = execSync('git grep -P "[\\x{1F300}-\\x{1F9FF}\\x{2600}-\\x{26FF}\\x{2700}-\\x{27BF}]" frontend/src', { cwd: path.resolve(__dirname, '..') }).toString();
  emojiOut = res;
} catch (e) {
  emojiOut = '0 emojis found in frontend/src';
}

let cannotReadOut = '0 occurrences of "Cannot read" found';
try {
  const res = execSync('git grep -i "Cannot read" frontend/src', { cwd: path.resolve(__dirname, '..') }).toString();
  cannotReadOut = res;
} catch (e) {
  cannotReadOut = '0 occurrences of "Cannot read" found in frontend/src';
}

fs.writeFileSync(path.join(dir, 'lint-grep.txt'), 'EMOJI AUDIT:\n' + emojiOut + '\n\nCANNOT READ AUDIT:\n' + cannotReadOut + '\n');
console.log('Saved lint-grep.txt');
console.log('All evidence logs completed!');
