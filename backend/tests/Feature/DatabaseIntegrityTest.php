<?php

namespace Tests\Feature;

use App\Domain\Inventory\Enums\InventoryMovementType;
use App\Domain\Returns\Enums\SalesReturnResolution;
use App\Domain\Sales\Enums\InvoiceItemType;
use App\Domain\Sales\Enums\InvoiceStatus;
use App\Domain\Sales\Enums\SaleType;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\InventoryMovement;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Product;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\Setting;
use App\Models\StockReceipt;
use App\Models\StockReceiptItem;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DatabaseIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_category_code_must_be_unique_at_database_level(): void
    {
        Category::create([
            'name' => 'كنب مودرن',
            'code' => 'K',
            'is_active' => true,
        ]);

        $this->expectException(QueryException::class);

        Category::create([
            'name' => 'كراسي مكاتب',
            'code' => 'K', // Duplicate code!
            'is_active' => true,
        ]);
    }

    public function test_product_barcode_must_be_unique_at_database_level(): void
    {
        $category = Category::create([
            'name' => 'غرف سفرة',
            'code' => 'D',
            'is_active' => true,
        ]);

        Product::create([
            'category_id' => $category->id,
            'name' => 'سفرة 6 كراسي',
            'barcode' => 'D0001',
            'purchase_cost' => Money::from(3000),
            'wholesale_price' => Money::from(3500),
            'retail_price' => Money::from(4000),
            'stock_quantity' => Quantity::from(2),
            'is_active' => true,
        ]);

        $this->expectException(QueryException::class);

        Product::create([
            'category_id' => $category->id,
            'name' => 'سفرة 8 كراسي',
            'barcode' => 'D0001', // Duplicate barcode!
            'purchase_cost' => Money::from(4000),
            'wholesale_price' => Money::from(4500),
            'retail_price' => Money::from(5000),
            'stock_quantity' => Quantity::from(1),
            'is_active' => true,
        ]);
    }

    public function test_product_is_independent_from_supplier(): void
    {
        $category = Category::create(['name' => 'أسرة', 'code' => 'B', 'is_active' => true]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'سرير كابوتنيه 160',
            'barcode' => 'B0001',
            'purchase_cost' => Money::from(2500),
            'wholesale_price' => Money::from(3000),
            'retail_price' => Money::from(3500),
            'stock_quantity' => Quantity::from(5),
            'is_active' => true,
        ]);

        // Verifies no mandatory supplier column exists or is required on Product
        $this->assertArrayNotHasKey('supplier_id', $product->getAttributes());
        $this->assertSame($category->id, $product->category->id);
    }

    public function test_retail_invoice_can_exist_without_customer(): void
    {
        $user = User::factory()->create();

        $invoice = Invoice::create([
            'invoice_number' => 'INV-RETAIL-001',
            'customer_id' => null, // Optional for retail
            'sale_type' => SaleType::RETAIL,
            'status' => InvoiceStatus::POSTED,
            'subtotal' => Money::from(500),
            'discount_amount' => Money::zero(),
            'total' => Money::from(500),
            'paid_amount' => Money::from(500),
            'remaining_amount' => Money::zero(),
            'credit_amount' => Money::zero(),
            'created_by' => $user->id,
        ]);

        $this->assertNull($invoice->customer_id);
        $this->assertTrue($invoice->isRetail());
        $this->assertFalse($invoice->isWholesale());
    }

    public function test_cannot_delete_category_when_products_exist_due_to_restrict_on_delete(): void
    {
        $category = Category::create(['name' => 'دواليب', 'code' => 'W', 'is_active' => true]);

        Product::create([
            'category_id' => $category->id,
            'name' => 'دولاب جرار 3 ضلفة',
            'barcode' => 'W0001',
            'purchase_cost' => Money::from(4000),
            'wholesale_price' => Money::from(5000),
            'retail_price' => Money::from(6000),
            'stock_quantity' => Quantity::from(1),
            'is_active' => true,
        ]);

        $this->expectException(QueryException::class);
        $category->forceDelete(); // Restrict on delete should reject hard deletion
    }

    public function test_inventory_movement_tracks_quantity_and_resulting_stock(): void
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'نيش وبوفيه', 'code' => 'N', 'is_active' => true]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'نيش مودرن 2 ضلفة',
            'barcode' => 'N0001',
            'purchase_cost' => Money::from(3000),
            'wholesale_price' => Money::from(3600),
            'retail_price' => Money::from(4200),
            'stock_quantity' => Quantity::from(5),
            'is_active' => true,
        ]);

        $movement = InventoryMovement::create([
            'product_id' => $product->id,
            'type' => InventoryMovementType::STOCK_RECEIPT,
            'quantity' => Quantity::from(5),
            'unit_cost' => Money::from(3000),
            'resulting_stock' => Quantity::from(5),
            'reason' => 'رصيد أول المدة',
            'created_by' => $user->id,
        ]);

        $this->assertSame($product->id, $movement->product->id);
        $this->assertSame(InventoryMovementType::STOCK_RECEIPT, $movement->type);
        $this->assertTrue($movement->quantity->equals(Quantity::from(5)));
        $this->assertTrue($movement->resulting_stock->equals(Quantity::from(5)));
        $this->assertTrue($movement->unit_cost->equals(Money::from(3000)));
    }

    public function test_audit_log_records_polymorphic_action_with_json_metadata(): void
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'مكاتب', 'code' => 'O', 'is_active' => true]);

        $log = AuditLog::create([
            'user_id' => $user->id,
            'action' => 'created',
            'auditable_type' => Category::class,
            'auditable_id' => $category->id,
            'old_values' => null,
            'new_values' => ['name' => 'مكاتب', 'code' => 'O'],
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit Test Agent',
        ]);

        $this->assertSame($category->id, $log->auditable->id);
        $this->assertSame('created', $log->action);
        $this->assertIsArray($log->new_values);
        $this->assertSame('مكاتب', $log->new_values['name']);
    }

    public function test_setting_store_and_retrieve_helper(): void
    {
        Setting::set('store_name', 'العالمية للأثاث والموبيليا', 'string', 'general');
        Setting::set('allow_negative_stock', false, 'boolean', 'inventory');
        Setting::set('max_discount_percentage', 15, 'integer', 'sales');

        $this->assertSame('العالمية للأثاث والموبيليا', Setting::get('store_name'));
        $this->assertFalse(Setting::get('allow_negative_stock'));
        $this->assertSame(15, Setting::get('max_discount_percentage'));
    }

    public function test_wholesale_invoice_associates_with_registered_customer(): void
    {
        $user = User::factory()->create();
        $customer = Customer::create([
            'name' => 'معرض السلام بالمنصورة',
            'phone' => '01099887766',
            'is_active' => true,
        ]);

        $invoice = Invoice::create([
            'invoice_number' => 'INV-WHOLESALE-001',
            'customer_id' => $customer->id,
            'sale_type' => SaleType::WHOLESALE,
            'status' => InvoiceStatus::POSTED,
            'subtotal' => Money::from(15000),
            'discount_amount' => Money::zero(),
            'total' => Money::from(15000),
            'paid_amount' => Money::from(10000),
            'remaining_amount' => Money::from(5000),
            'credit_amount' => Money::zero(),
            'created_by' => $user->id,
        ]);

        $this->assertTrue($invoice->isWholesale());
        $this->assertSame($customer->id, $invoice->customer->id);
        $this->assertTrue($invoice->remaining_amount->equals(Money::from(5000)));
    }

    public function test_external_product_invoice_item_supports_polymorphic_linked_expense(): void
    {
        $user = User::factory()->create();
        $category = ExpenseCategory::create([
            'name' => 'تكلفة بضاعة خارجية',
            'code' => 'ext_prod',
            'is_active' => true,
        ]);

        $invoice = Invoice::create([
            'invoice_number' => 'INV-EXT-001',
            'customer_id' => null,
            'sale_type' => SaleType::RETAIL,
            'status' => InvoiceStatus::POSTED,
            'subtotal' => Money::from(800),
            'discount_amount' => Money::zero(),
            'total' => Money::from(800),
            'paid_amount' => Money::from(800),
            'remaining_amount' => Money::zero(),
            'credit_amount' => Money::zero(),
            'created_by' => $user->id,
        ]);

        $item = InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'product_id' => null, // External product has no master product
            'item_type' => InvoiceItemType::EXTERNAL,
            'product_name' => 'مرتبة تطرية تركي عمولة',
            'barcode' => null,
            'quantity' => Quantity::from(2),
            'unit_sale_price' => Money::from(400),
            'unit_cost' => Money::from(300),
            'subtotal' => Money::from(800),
            'total_cost' => Money::from(600),
            'profit' => Money::from(200),
        ]);

        // External product cost creates linked expense
        $expense = Expense::create([
            'expense_category_id' => $category->id,
            'amount' => Money::from(600),
            'expense_date' => now()->toDateString(),
            'description' => 'تكلفة شراء مرتبة تطرية تركي عمولة للفاتورة '.$invoice->invoice_number,
            'reference_type' => InvoiceItem::class,
            'reference_id' => $item->id,
            'created_by' => $user->id,
        ]);

        $this->assertTrue($item->isExternalProduct());
        $this->assertNull($item->product_id);
        $this->assertSame($item->id, $expense->reference->id);
        $this->assertTrue($expense->amount->equals(Money::from(600)));
    }

    public function test_stock_receipt_records_items_and_links_to_supplier(): void
    {
        $user = User::factory()->create();
        $supplier = Supplier::create([
            'name' => 'مصنع الخشب الزان',
            'phone' => '01000000000',
            'is_active' => true,
        ]);

        $category = Category::create(['name' => 'صالون', 'code' => 'Z', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'صالون ملكي',
            'barcode' => 'Z0001',
            'purchase_cost' => Money::from(10000),
            'wholesale_price' => Money::from(12000),
            'retail_price' => Money::from(14000),
            'stock_quantity' => Quantity::from(0),
            'is_active' => true,
        ]);

        $receipt = StockReceipt::create([
            'receipt_number' => 'SR-2026-001',
            'supplier_id' => $supplier->id,
            'received_date' => now()->toDateString(),
            'total_cost' => Money::from(20000),
            'notes' => 'استلام صالونين ملكي',
            'created_by' => $user->id,
        ]);

        $receiptItem = StockReceiptItem::create([
            'stock_receipt_id' => $receipt->id,
            'product_id' => $product->id,
            'quantity' => Quantity::from(2),
            'unit_cost' => Money::from(10000),
            'subtotal' => Money::from(20000),
        ]);

        $this->assertSame($supplier->id, $receipt->supplier->id);
        $this->assertCount(1, $receipt->items);
        $this->assertSame($product->id, $receiptItem->product->id);
    }

    public function test_sales_return_and_return_items_preserve_historical_profit_reversal(): void
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'أباجورات', 'code' => 'L', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'أباجورة نحاس',
            'barcode' => 'L0001',
            'purchase_cost' => Money::from(200),
            'wholesale_price' => Money::from(250),
            'retail_price' => Money::from(300),
            'stock_quantity' => Quantity::from(5),
            'is_active' => true,
        ]);

        $invoice = Invoice::create([
            'invoice_number' => 'INV-RET-ORIG-001',
            'customer_id' => null,
            'sale_type' => SaleType::RETAIL,
            'status' => InvoiceStatus::POSTED,
            'subtotal' => Money::from(600),
            'discount_amount' => Money::zero(),
            'total' => Money::from(600),
            'paid_amount' => Money::from(600),
            'remaining_amount' => Money::zero(),
            'credit_amount' => Money::zero(),
            'created_by' => $user->id,
        ]);

        $invoiceItem = InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'product_id' => $product->id,
            'item_type' => InvoiceItemType::PRODUCT,
            'product_name' => $product->name,
            'barcode' => $product->barcode,
            'quantity' => Quantity::from(2),
            'unit_sale_price' => Money::from(300),
            'unit_cost' => Money::from(200),
            'subtotal' => Money::from(600),
            'total_cost' => Money::from(400),
            'profit' => Money::from(200),
        ]);

        $return = SalesReturn::create([
            'return_number' => 'RET-2026-001',
            'invoice_id' => $invoice->id,
            'customer_id' => null,
            'resolution' => SalesReturnResolution::REFUND_CASH,
            'total_return_amount' => Money::from(300), // Returning 1 item
            'difference_amount' => Money::zero(),
            'notes' => 'مرتجع قطعة واحدة نقداً',
            'created_by' => $user->id,
        ]);

        $returnItem = SalesReturnItem::create([
            'sales_return_id' => $return->id,
            'invoice_item_id' => $invoiceItem->id,
            'product_id' => $product->id,
            'quantity' => Quantity::from(1),
            'unit_sale_price' => Money::from(300),
            'unit_cost' => Money::from(200), // Snapshot from original invoice item
            'subtotal' => Money::from(300),
            'profit_reversal' => Money::from(100), // (300 - 200) * 1
        ]);

        $this->assertSame($invoice->id, $return->invoice->id);
        $this->assertTrue($returnItem->profit_reversal->equals(Money::from(100)));
    }

    public function test_cannot_force_delete_product_when_inventory_movements_exist(): void
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'طاولات قهوة', 'code' => 'K', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'طاولة قهوة زجاج',
            'barcode' => 'K0001',
            'purchase_cost' => Money::from(800),
            'wholesale_price' => Money::from(1000),
            'retail_price' => Money::from(1200),
            'stock_quantity' => Quantity::from(3),
            'is_active' => true,
        ]);

        InventoryMovement::create([
            'product_id' => $product->id,
            'type' => InventoryMovementType::STOCK_RECEIPT,
            'quantity' => Quantity::from(3),
            'unit_cost' => Money::from(800),
            'resulting_stock' => Quantity::from(3),
            'created_by' => $user->id,
        ]);

        $this->expectException(QueryException::class);
        $product->forceDelete(); // Must fail due to restrictOnDelete protecting movement ledger
    }
}
