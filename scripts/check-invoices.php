<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require __DIR__ . '/../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$invoices = App\Models\Invoice::with(['returns', 'replacementForReturn'])->get();
foreach ($invoices as $inv) {
    echo "ID: {$inv->id} | Num: {$inv->invoice_number} | Type: {$inv->sale_type->value} | Repl: " . ($inv->replacementForReturn ? 'YES' : 'NO') . " | Returns: " . $inv->returns->count() . "\n";
}
