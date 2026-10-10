# ==============================================================================
# Al-Alamiya ERP/POS — Comprehensive Financial Backup & Restore Verification Drill
# Verifies row counts of ALL financial tables + Customer Ledger + Supplier Payable
# ==============================================================================

$MysqlExe = "C:\xampp\mysql\bin\mysql.exe"
$DbName = "elalamya_test"
$BackupDir = "D:\elalamya-backups\full_financial_drill"

Write-Host "=== 1. Resetting test database $DbName ==="
Push-Location "d:\elalamya-main\backend"
php artisan migrate:fresh --database=mysql --force
Pop-Location

# Seed comprehensive financial scenario using SQL
$setupSql = @"
USE $DbName;
SET FOREIGN_KEY_CHECKS = 0;

-- Users
REPLACE INTO users (id, name, username, email, password, role, is_active, created_at, updated_at)
VALUES (1, 'مالك المعرض', 'owner', 'owner@elalamya.com', 'hash', 'owner', 1, NOW(), NOW());

-- Category & Product
REPLACE INTO categories (id, name, code, is_active, created_at, updated_at)
VALUES (1, 'ألحفة وبطاطين', 'B', 1, NOW(), NOW());

REPLACE INTO products (id, category_id, name, barcode, purchase_cost, wholesale_price, retail_price, stock_quantity, is_active, created_at, updated_at)
VALUES (1, 1, 'لحاف شتوي دبل', 'B0001', 500.00, 600.00, 650.00, 20, 1, NOW(), NOW());

-- Payment Method
REPLACE INTO payment_methods (id, name, code, is_cash, is_active, created_at, updated_at)
VALUES (1, 'نقدي كاش', 'cash', 1, 1, NOW(), NOW());

-- Customer & Transactions
REPLACE INTO customers (id, name, phone, address, is_active, created_at, updated_at)
VALUES (1, 'شركة الدلتا لتجارة المفروشات', '01012345678', 'طنطا', 1, NOW(), NOW());

REPLACE INTO customer_transactions (id, customer_id, type, amount, direction, reference_type, reference_id, description, created_by, created_at, updated_at)
VALUES 
(1, 1, 'invoice', 5000.00, 'debit', 'Invoice', 1, 'فاتورة جملة رقم INV-1001', 1, NOW(), NOW()),
(2, 1, 'payment', 2000.00, 'credit', NULL, NULL, 'سداد دفعة نقدية', 1, NOW(), NOW());

-- Supplier & Transactions
REPLACE INTO suppliers (id, name, phone, address, is_active, created_at, updated_at)
VALUES (1, 'مصنع الدلتا للغزل والنسيج', '01012345678', 'المنصورة', 1, NOW(), NOW());

REPLACE INTO supplier_transactions (id, supplier_id, type, amount, direction, reference_type, reference_id, description, created_by, created_at, updated_at)
VALUES
(1, 1, 'stock_receipt', 8000.00, 'credit', 'StockReceipt', 1, 'استلام بضاعة إذن رقم REC-1001', 1, NOW(), NOW()),
(2, 1, 'payment', 3000.00, 'debit', NULL, NULL, 'سداد دفعة للمصنع', 1, NOW(), NOW());

-- Payments table
REPLACE INTO payments (id, payment_number, payment_method_id, amount, payment_type, payable_type, payable_id, notes, paid_at, created_by, created_at, updated_at)
VALUES (1, 'PAY-1001', 1, 2000.00, 'invoice_payment', 'App\\Models\\Invoice', 1, 'دفعة نقدية', NOW(), 1, NOW(), NOW());

-- Stock Receipt & Items
REPLACE INTO stock_receipts (id, receipt_number, supplier_id, received_date, total_cost, notes, created_by, created_at, updated_at)
VALUES (1, 'REC-1001', 1, CURDATE(), 8000.00, 'توريد ألحفة', 1, NOW(), NOW());

REPLACE INTO stock_receipt_items (id, stock_receipt_id, product_id, quantity, unit_cost, subtotal, created_at, updated_at)
VALUES (1, 1, 1, 16, 500.00, 8000.00, NOW(), NOW());

-- Invoice, Items, Payments
REPLACE INTO invoices (id, invoice_number, customer_id, sale_type, status, subtotal, discount_amount, total, paid_amount, remaining_amount, credit_amount, created_by, created_at, updated_at)
VALUES (1, 'INV-1001', 1, 'wholesale', 'posted', 5000.00, 0.00, 5000.00, 2000.00, 3000.00, 0.00, 1, NOW(), NOW());

REPLACE INTO invoice_items (id, invoice_id, product_id, item_type, product_name, barcode, quantity, unit_sale_price, unit_cost, subtotal, profit, created_at, updated_at)
VALUES (1, 1, 1, 'product', 'لحاف شتوي دبل', 'B0001', 10, 500.00, 400.00, 5000.00, 1000.00, NOW(), NOW());

REPLACE INTO invoice_payments (id, invoice_id, payment_method_id, amount, notes, created_by, created_at)
VALUES (1, 1, 1, 2000.00, 'دفعة تعاقد', 1, NOW());

-- Sales Return & Return Items
REPLACE INTO sales_returns (id, return_number, invoice_id, customer_id, resolution, total_return_amount, difference_amount, notes, created_by, created_at, updated_at)
VALUES (1, 'RET-1001', 1, 1, 'refund_cash', 500.00, 0.00, 'مرتجع نقدي', 1, NOW(), NOW());

REPLACE INTO sales_return_items (id, sales_return_id, invoice_item_id, product_id, quantity, unit_sale_price, unit_cost, subtotal, profit_reversal, created_at, updated_at)
VALUES (1, 1, 1, 1, 1, 500.00, 400.00, 500.00, 100.00, NOW(), NOW());

-- Expense
REPLACE INTO expense_categories (id, name, is_active, created_at, updated_at)
VALUES (1, 'مصاريف نقل ومشال', 1, NOW(), NOW());

REPLACE INTO expenses (id, expense_category_id, payment_method_id, amount, expense_date, description, created_by, created_at, updated_at)
VALUES (1, 1, 1, 350.00, CURDATE(), 'نقل بضاعة من المخزن للمعرض', 1, NOW(), NOW());

-- Inventory Movement
REPLACE INTO inventory_movements (id, product_id, type, quantity, unit_cost, resulting_stock, reference_type, reference_id, reason, created_by, created_at, updated_at)
VALUES (1, 1, 'stock_receipt', 16, 500.00, 20, 'StockReceipt', 1, 'استلام بضاعة', 1, NOW(), NOW());
SET FOREIGN_KEY_CHECKS = 1;
"@

$setupPath = "d:\elalamya-main\scripts\drill_full_scenario.sql"
Set-Content -Path $setupPath -Value $setupSql -Encoding UTF8
cmd.exe /c "`"$MysqlExe`" -u root --default-character-set=utf8mb4 < `"$setupPath`""
Remove-Item -Path $setupPath -Force

$queryScript = @"
SELECT 
    (SELECT COUNT(*) FROM invoices) AS cnt_invoices,
    (SELECT COUNT(*) FROM invoice_items) AS cnt_invoice_items,
    (SELECT COUNT(*) FROM invoice_payments) AS cnt_invoice_payments,
    (SELECT COUNT(*) FROM payments) AS cnt_payments,
    (SELECT COUNT(*) FROM customer_transactions) AS cnt_customer_tx,
    (SELECT COUNT(*) FROM supplier_transactions) AS cnt_supplier_tx,
    (SELECT COUNT(*) FROM expenses) AS cnt_expenses,
    (SELECT COUNT(*) FROM sales_returns) AS cnt_sales_returns,
    (SELECT COUNT(*) FROM sales_return_items) AS cnt_return_items,
    (SELECT COUNT(*) FROM inventory_movements) AS cnt_inv_movements,
    (SELECT COUNT(*) FROM stock_receipts) AS cnt_receipts,
    (SELECT COUNT(*) FROM stock_receipt_items) AS cnt_receipt_items,
    (SELECT SUM(CASE WHEN direction = 'debit' THEN amount ELSE -amount END) FROM customer_transactions) AS customer_balance,
    (SELECT SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) FROM supplier_transactions) AS supplier_payable;
"@

Write-Host "`n=== 2. FINANCIAL STATE BEFORE BACKUP ==="
$stateBefore = & "$MysqlExe" -u root -e "USE $DbName; $queryScript"
$stateBefore | Out-String | Write-Host

Write-Host "=== 3. Executing backup-database.ps1 (credentials file mode) ==="
powershell -ExecutionPolicy Bypass -File "d:\elalamya-main\scripts\backup-database.ps1" -DbName $DbName -BackupDir $BackupDir

$filterStr = $DbName + "_backup_*.sql"
$dumps = Get-ChildItem -Path $BackupDir -Filter $filterStr | Sort-Object LastWriteTime -Descending
$latestDump = $dumps[0].FullName
Write-Host "Produced Backup File: $latestDump"

Write-Host "`n=== 4. Disaster Simulation (Wiping database completely) ==="
& "$MysqlExe" -u root -e "DROP DATABASE $DbName; CREATE DATABASE $DbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

Write-Host "=== 5. Restoring database via restore-database.ps1 ==="
powershell -ExecutionPolicy Bypass -File "d:\elalamya-main\scripts\restore-database.ps1" -DbName $DbName -DumpFilePath $latestDump

Write-Host "`n=== 6. FINANCIAL STATE AFTER RESTORE ==="
$stateAfter = & "$MysqlExe" -u root -e "USE $DbName; $queryScript"
$stateAfter | Out-String | Write-Host

# Clean drill folder
Remove-Item -Path $BackupDir -Recurse -Force

# Compare
if (($stateBefore | Out-String) -eq ($stateAfter | Out-String)) {
    Write-Host "`n=== DRILL RESULT: SUCCESS - 100% MATCH ON ALL 11 FINANCIAL TABLES AND BALANCES ==="
    exit 0
} else {
    Write-Error "DRILL RESULT: MISMATCH DETECTED"
    exit 1
}
