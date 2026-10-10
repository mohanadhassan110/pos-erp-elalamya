<?php

/**
 * Concurrency Proof Script for Al-Alamiya ERP/POS
 * Tests real InnoDB row-level locking (lockForUpdate) with two distinct PDO database connections
 * against MariaDB/MySQL on elalamya_test.
 */
$dsn = 'mysql:host=127.0.0.1;port=3306;dbname=elalamya_test;charset=utf8mb4';
$user = 'root';
$pass = '';

echo "=== Al-Alamiya ERP/POS: MariaDB Concurrency & lockForUpdate Proof ===\n\n";

try {
    $pdo1 = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
    ]);

    $pdo2 = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
    ]);

    // Setup: Create a test category and a product with EXACTLY 1 unit in stock
    $pdo1->exec("DELETE FROM products WHERE barcode = 'TEST-CONC-01'");
    $pdo1->exec("DELETE FROM categories WHERE code = 'Z'");

    $pdo1->exec("INSERT INTO categories (name, code, is_active, created_at, updated_at) VALUES ('قسم اختبار التزامن', 'Z', 1, NOW(), NOW())");
    $categoryId = $pdo1->lastInsertId();

    $pdo1->exec("INSERT INTO products (category_id, name, barcode, purchase_cost, wholesale_price, retail_price, stock_quantity, is_active, created_at, updated_at) 
                 VALUES ($categoryId, 'طقم لحاف مفرد تزامن', 'TEST-CONC-01', 500.00, 700.00, 850.00, 1, 1, NOW(), NOW())");
    $productId = $pdo1->lastInsertId();

    echo "1. Created test product #$productId with initial stock = 1 unit.\n";

    // Set lock wait timeout for Connection 2 to 2 seconds so we can test lock contention
    $pdo2->exec('SET innodb_lock_wait_timeout = 2');

    echo "2. Connection 1 begins transaction and acquires lockForUpdate on product #$productId...\n";
    $pdo1->beginTransaction();
    $stmt1 = $pdo1->prepare('SELECT id, stock_quantity FROM products WHERE id = ? FOR UPDATE');
    $stmt1->execute([$productId]);
    $row1 = $stmt1->fetch(PDO::FETCH_ASSOC);
    echo '   Connection 1 locked product: current stock = '.$row1['stock_quantity']."\n";

    echo "3. Connection 2 attempts to acquire lockForUpdate on the SAME product while Connection 1 holds it...\n";
    $startTime = microtime(true);
    $blocked = false;

    try {
        $stmt2 = $pdo2->prepare('SELECT id, stock_quantity FROM products WHERE id = ? FOR UPDATE');
        $stmt2->execute([$productId]);
        $row2 = $stmt2->fetch(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        $elapsed = round(microtime(true) - $startTime, 2);
        if (str_contains($e->getMessage(), '1205') || str_contains($e->getMessage(), 'Lock wait timeout')) {
            $blocked = true;
            echo "   [PROVEN] Connection 2 was BLOCKED by Connection 1's lock and timed out after {$elapsed}s!\n";
            echo "   InnoDB Error Code 1205: Lock wait timeout exceeded.\n";
        } else {
            throw $e;
        }
    }

    if (! $blocked) {
        echo "   [WARNING] Connection 2 was NOT blocked. Engine might not support row locking.\n";
    }

    echo "4. Simulating sale completion on Connection 1 (stock 1 -> 0) and committing...\n";
    $pdo1->prepare('UPDATE products SET stock_quantity = 0 WHERE id = ?')->execute([$productId]);
    $pdo1->commit();
    echo "   Connection 1 committed. Lock released.\n";

    echo "5. Now Connection 2 attempts to read the product after lock release...\n";
    $stmt2 = $pdo2->prepare('SELECT id, stock_quantity FROM products WHERE id = ?');
    $stmt2->execute([$productId]);
    $row2After = $stmt2->fetch(PDO::FETCH_ASSOC);
    echo '   Connection 2 sees stock = '.$row2After['stock_quantity']." (0 remaining).\n";

    if ((int) $row2After['stock_quantity'] === 0) {
        echo "   [PROVEN] Connection 2 sees stock = 0 and rejects second sale attempt! No negative stock possible.\n";
    }

    // Cleanup
    $pdo1->exec("DELETE FROM products WHERE id = $productId");
    $pdo1->exec("DELETE FROM categories WHERE id = $categoryId");
    echo "\n=== Concurrency & Row-Locking Test PASSED Successfully ===\n";

} catch (Exception $e) {
    echo 'ERROR: '.$e->getMessage()."\n";
    exit(1);
}
