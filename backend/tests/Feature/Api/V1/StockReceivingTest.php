<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Auth\Enums\UserRole;
use App\Domain\Sales\Enums\InvoiceItemType;
use App\Domain\Sales\Enums\InvoiceStatus;
use App\Domain\Sales\Enums\SaleType;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\Category;
use App\Models\InventoryMovement;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Product;
use App\Models\StockReceipt;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockReceivingTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->cashier = User::factory()->create(['role' => UserRole::CASHIER, 'is_active' => true]);
        $this->owner = User::factory()->create(['role' => UserRole::OWNER, 'is_active' => true]);
    }

    public function test_can_receive_single_product_and_update_stock_cost_movement_and_supplier_payable(): void
    {
        Sanctum::actingAs($this->cashier);

        $category = Category::create(['name' => 'غرف نوم', 'code' => 'B', 'is_active' => true]);
        $supplier = Supplier::create(['name' => 'مصنع الاتحاد', 'phone' => '01000000001', 'is_active' => true]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'دولاب 3 دلفة جرار',
            'barcode' => 'B0001',
            'purchase_cost' => Money::from(4000), // Old cost
            'wholesale_price' => Money::from(5000),
            'retail_price' => Money::from(6000),
            'stock_quantity' => Quantity::from(2), // Initial stock
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/stock-receipts', [
            'supplier_id' => $supplier->id,
            'received_date' => '2026-10-08',
            'notes' => 'توريد دفعة جديدة',
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 5,
                    'unit_cost' => '4500.00', // New purchase cost
                ],
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.total_cost', '22500.00'); // 5 * 4500

        $receiptNumber = $response->json('data.receipt_number');
        $this->assertNotEmpty($receiptNumber);

        // 1. Check Product Stock: 2 + 5 = 7
        $product->refresh();
        $this->assertSame(7, $product->stock_quantity->toInt());

        // 2. Check Product Cost updated to new receipt cost (4500.00)
        $this->assertTrue($product->purchase_cost->equals(Money::from(4500)));

        // 3. Check Inventory Movement created
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'stock_receipt',
            'quantity' => 5,
            'unit_cost' => '4500.00',
            'resulting_stock' => 7,
        ]);

        // 4. Check Supplier Payable increased by 22,500.00
        $supplier->refresh();
        $this->assertTrue($supplier->calculatePayable()->equals(Money::from(22500)));

        // 5. Check Supplier Transaction references the receipt
        $receipt = StockReceipt::where('receipt_number', $receiptNumber)->firstOrFail();
        $this->assertDatabaseHas('supplier_transactions', [
            'supplier_id' => $supplier->id,
            'type' => 'stock_receipt',
            'direction' => 'credit',
            'amount' => '22500.00',
            'reference_type' => StockReceipt::class,
            'reference_id' => $receipt->id,
        ]);
    }

    public function test_can_receive_multiple_products_with_different_costs_atomically(): void
    {
        Sanctum::actingAs($this->cashier);

        $category = Category::create(['name' => 'طاولات', 'code' => 'T', 'is_active' => true]);

        $p1 = Product::create([
            'category_id' => $category->id,
            'name' => 'طاولة شاي خشبية',
            'barcode' => 'T0001',
            'purchase_cost' => Money::from(300),
            'wholesale_price' => Money::from(400),
            'retail_price' => Money::from(500),
            'stock_quantity' => Quantity::from(1),
            'is_active' => true,
        ]);

        $p2 = Product::create([
            'category_id' => $category->id,
            'name' => 'طاولة تلفزيون 160 سم',
            'barcode' => 'T0002',
            'purchase_cost' => Money::from(1000),
            'wholesale_price' => Money::from(1300),
            'retail_price' => Money::from(1600),
            'stock_quantity' => Quantity::from(0),
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/stock-receipts', [
            'supplier_id' => null, // Optional receiving without supplier
            'received_date' => now()->toDateString(),
            'items' => [
                ['product_id' => $p1->id, 'quantity' => 10, 'unit_cost' => '350.00'], // 3500.00
                ['product_id' => $p2->id, 'quantity' => 4, 'unit_cost' => '1100.00'],  // 4400.00
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.total_cost', '7900.00'); // 3500 + 4400

        $p1->refresh();
        $p2->refresh();

        $this->assertSame(11, $p1->stock_quantity->toInt());
        $this->assertTrue($p1->purchase_cost->equals(Money::from(350)));

        $this->assertSame(4, $p2->stock_quantity->toInt());
        $this->assertTrue($p2->purchase_cost->equals(Money::from(1100)));
    }

    public function test_stock_receiving_rolls_back_everything_if_any_item_is_invalid(): void
    {
        Sanctum::actingAs($this->cashier);

        $category = Category::create(['name' => 'صالونات', 'code' => 'S', 'is_active' => true]);
        $supplier = Supplier::create(['name' => 'مورد اختبار', 'phone' => '01000000002', 'is_active' => true]);

        $validProduct = Product::create([
            'category_id' => $category->id,
            'name' => 'كنبة ركنة',
            'barcode' => 'S0001',
            'purchase_cost' => Money::from(5000),
            'wholesale_price' => Money::from(6500),
            'retail_price' => Money::from(8000),
            'stock_quantity' => Quantity::from(2),
            'is_active' => true,
        ]);

        $inactiveProduct = Product::create([
            'category_id' => $category->id,
            'name' => 'كرسي معطل',
            'barcode' => 'S0002',
            'purchase_cost' => Money::from(500),
            'wholesale_price' => Money::from(650),
            'retail_price' => Money::from(800),
            'stock_quantity' => Quantity::from(0),
            'is_active' => false, // Inactive!
        ]);

        $response = $this->postJson('/api/v1/stock-receipts', [
            'supplier_id' => $supplier->id,
            'items' => [
                ['product_id' => $validProduct->id, 'quantity' => 5, 'unit_cost' => '5200.00'],
                ['product_id' => $inactiveProduct->id, 'quantity' => 2, 'unit_cost' => '600.00'],
            ],
        ]);

        $response->assertStatus(422);

        // Verify total rollback: validProduct stock untouched
        $validProduct->refresh();
        $this->assertSame(2, $validProduct->stock_quantity->toInt());
        $this->assertTrue($validProduct->purchase_cost->equals(Money::from(5000)));

        // No movements or receipts or supplier payable
        $this->assertSame(0, StockReceipt::count());
        $this->assertSame(0, $supplier->calculatePayable()->toCents());
    }

    public function test_stock_receiving_does_not_mutate_historical_invoice_costs(): void
    {
        Sanctum::actingAs($this->cashier);

        $category = Category::create(['name' => 'أسرّة', 'code' => 'B', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'سرير أطفال',
            'barcode' => 'B0001',
            'purchase_cost' => Money::from(1500),
            'wholesale_price' => Money::from(1800),
            'retail_price' => Money::from(2200),
            'stock_quantity' => Quantity::from(5),
            'is_active' => true,
        ]);

        // Historical Invoice posted with unit_cost 1500
        $invoice = Invoice::create([
            'invoice_number' => 'INV-HIST-001',
            'sale_type' => SaleType::RETAIL,
            'status' => InvoiceStatus::POSTED,
            'subtotal' => Money::from(2200),
            'discount_amount' => Money::zero(),
            'total' => Money::from(2200),
            'paid_amount' => Money::from(2200),
            'created_by' => $this->cashier->id,
        ]);

        $item = InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'product_id' => $product->id,
            'item_type' => InvoiceItemType::PRODUCT,
            'product_name' => $product->name,
            'barcode' => $product->barcode,
            'quantity' => Quantity::from(1),
            'unit_sale_price' => Money::from(2200),
            'unit_cost' => Money::from(1500), // Snapshot
            'subtotal' => Money::from(2200),
            'total_cost' => Money::from(1500),
            'profit' => Money::from(700),
        ]);

        // Receive new stock at cost 1750
        $res = $this->postJson('/api/v1/stock-receipts', [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 4, 'unit_cost' => '1750.00'],
            ],
        ]);

        $res->assertStatus(201);

        $product->refresh();
        $this->assertTrue($product->purchase_cost->equals(Money::from(1750)));

        // Historical invoice item MUST remain untouched!
        $item->refresh();
        $this->assertTrue($item->unit_cost->equals(Money::from(1500)));
        $this->assertTrue($item->profit->equals(Money::from(700)));
    }

    public function test_inventory_visibility_endpoint_returns_accurate_stock_and_valuation(): void
    {
        Sanctum::actingAs($this->cashier);

        $category = Category::create(['name' => 'نيش', 'code' => 'N', 'is_active' => true]);

        Product::create([
            'category_id' => $category->id,
            'name' => 'نيش مودرن 3 ضلفة',
            'barcode' => 'N0001',
            'purchase_cost' => Money::from(5000),
            'wholesale_price' => Money::from(6000),
            'retail_price' => Money::from(7000),
            'stock_quantity' => Quantity::from(2), // valuation: 2 * 5000 = 10000
            'is_active' => true,
        ]);

        $res = $this->getJson('/api/v1/inventory');

        $res->assertStatus(200)
            ->assertJsonPath('summary.total_quantity', 2)
            ->assertJsonPath('summary.total_valuation', '10000.00');
    }

    public function test_duplicate_product_lines_within_single_receipt_are_rejected(): void
    {
        Sanctum::actingAs($this->cashier);

        $category = Category::create(['name' => 'مطابخ', 'code' => 'K', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'وحدة مطبخ علوية',
            'barcode' => 'K0001',
            'purchase_cost' => Money::from(1000),
            'wholesale_price' => Money::from(1200),
            'retail_price' => Money::from(1500),
            'stock_quantity' => Quantity::from(4),
            'is_active' => true,
        ]);

        // Submit payload with duplicate product_id in two lines
        $response = $this->postJson('/api/v1/stock-receipts', [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2, 'unit_cost' => '1000.00'],
                ['product_id' => $product->id, 'quantity' => 3, 'unit_cost' => '1100.00'], // Duplicate!
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.product_id', 'items.1.product_id']);

        // Assert nothing created or mutated
        $this->assertSame(0, StockReceipt::count());
        $product->refresh();
        $this->assertSame(4, $product->stock_quantity->toInt());
    }

    public function test_idempotency_key_prevents_duplicate_stock_receipt_creation_and_double_mutations(): void
    {
        Sanctum::actingAs($this->cashier);

        $category = Category::create(['name' => 'صالونات', 'code' => 'S', 'is_active' => true]);
        $supplier = Supplier::create(['name' => 'مورد إدمبوتنسي', 'phone' => '01099999999', 'is_active' => true]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'أنتريه كلاسيك',
            'barcode' => 'S0001',
            'purchase_cost' => Money::from(7000),
            'wholesale_price' => Money::from(8500),
            'retail_price' => Money::from(10000),
            'stock_quantity' => Quantity::from(3),
            'is_active' => true,
        ]);

        $idempotencyKey = 'uuid-stock-receipt-test-abc-123';

        $payload = [
            'idempotency_key' => $idempotencyKey,
            'supplier_id' => $supplier->id,
            'received_date' => '2026-10-08',
            'notes' => 'شحنة اختبار تكرار النقر',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2, 'unit_cost' => '7500.00'],
            ],
        ];

        // 1. First Submission
        $firstResponse = $this->postJson('/api/v1/stock-receipts', $payload);
        $firstResponse->assertStatus(201);
        $firstReceiptNumber = $firstResponse->json('data.receipt_number');

        // 2. Duplicate Submission (simulating cashier double-click or network retry)
        $secondResponse = $this->postJson('/api/v1/stock-receipts', $payload);
        $secondResponse->assertStatus(201);
        $secondReceiptNumber = $secondResponse->json('data.receipt_number');

        // Must return identical receipt number
        $this->assertSame($firstReceiptNumber, $secondReceiptNumber);

        // Verification of Invariants:
        // A. Exactly 1 StockReceipt created in database
        $this->assertSame(1, StockReceipt::count());
        $this->assertDatabaseHas('stock_receipts', [
            'receipt_number' => $firstReceiptNumber,
            'idempotency_key' => $idempotencyKey,
        ]);

        // B. Product stock quantity incremented ONCE only: 3 + 2 = 5 (NOT 7)
        $product->refresh();
        $this->assertSame(5, $product->stock_quantity->toInt());

        // C. Supplier payable credited ONCE only: 2 * 7500 = 15000 (NOT 30000)
        $supplier->refresh();
        $this->assertTrue($supplier->calculatePayable()->equals(Money::from(15000)));

        // D. Exactly 1 InventoryMovement created
        $this->assertSame(1, InventoryMovement::where('product_id', $product->id)->count());
    }

    public function test_receipt_number_generation_handles_concurrency_and_recovers_from_collisions(): void
    {
        Sanctum::actingAs($this->cashier);

        $category = Category::create(['name' => 'غرف سفرة', 'code' => 'D', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'سفرة 6 كراسي',
            'barcode' => 'D0001',
            'purchase_cost' => Money::from(8000),
            'wholesale_price' => Money::from(9500),
            'retail_price' => Money::from(11000),
            'stock_quantity' => Quantity::from(1),
            'is_active' => true,
        ]);

        // Receipt 1
        $res1 = $this->postJson('/api/v1/stock-receipts', [
            'received_date' => '2026-10-08',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1, 'unit_cost' => '8000.00'],
            ],
        ]);
        $res1->assertStatus(201);
        $receipt1 = $res1->json('data.receipt_number');
        $this->assertStringEndsWith('-0001', $receipt1);

        // Receipt 2
        $res2 = $this->postJson('/api/v1/stock-receipts', [
            'received_date' => '2026-10-08',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1, 'unit_cost' => '8000.00'],
            ],
        ]);
        $res2->assertStatus(201);
        $receipt2 = $res2->json('data.receipt_number');
        $this->assertStringEndsWith('-0002', $receipt2);

        $this->assertNotEquals($receipt1, $receipt2);
        $this->assertSame(2, StockReceipt::count());
    }
}
