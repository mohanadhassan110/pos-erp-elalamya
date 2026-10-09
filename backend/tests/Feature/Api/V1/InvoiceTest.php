<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Auth\Enums\UserRole;
use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Customers\Enums\CustomerTransactionType;
use App\Domain\Inventory\Enums\InventoryMovementType;
use App\Domain\Sales\Enums\InvoiceItemType;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerTransaction;
use App\Models\Expense;
use App\Models\InventoryMovement;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class InvoiceTest extends TestCase
{
    use RefreshDatabase;

    protected User $cashier;

    protected User $owner;

    protected Category $category;

    protected Product $product1;

    protected Product $product2;

    protected Customer $customer;

    protected PaymentMethod $cashMethod;

    protected PaymentMethod $cardMethod;

    protected function setUp(): void
    {
        parent::setUp();

        $this->cashier = User::factory()->create([
            'role' => UserRole::CASHIER,
            'is_active' => true,
        ]);

        $this->owner = User::factory()->create([
            'role' => UserRole::OWNER,
            'is_active' => true,
        ]);

        $this->category = Category::factory()->create([
            'code' => 'B',
            'name' => 'غرف نوم',
            'is_active' => true,
        ]);

        $this->product1 = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'سرير كينج 180 سم',
            'barcode' => 'B0001',
            'purchase_cost' => 500.00,
            'wholesale_price' => 600.00,
            'retail_price' => 650.00,
            'stock_quantity' => 10,
            'is_active' => true,
        ]);

        $this->product2 = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'كومودينو مودرن',
            'barcode' => 'B0002',
            'purchase_cost' => 150.00,
            'wholesale_price' => 200.00,
            'retail_price' => 220.00,
            'stock_quantity' => 5,
            'is_active' => true,
        ]);

        $this->customer = Customer::factory()->create([
            'name' => 'معرض الأمل للموبيليا',
            'phone' => '01011112222',
            'is_active' => true,
        ]);

        $this->cashMethod = PaymentMethod::firstOrCreate(
            ['code' => 'cash'],
            ['name' => 'نقدي', 'is_cash' => true, 'is_active' => true]
        );

        $this->cardMethod = PaymentMethod::firstOrCreate(
            ['code' => 'card'],
            ['name' => 'بطاقة بنكية', 'is_cash' => false, 'is_active' => true]
        );
    }

    public function test_can_search_product_by_barcode(): void
    {
        $response = $this->actingAs($this->cashier)
            ->getJson("/api/v1/products/barcode/{$this->product1->barcode}");

        $response->assertOk()
            ->assertJsonPath('data.barcode', 'B0001')
            ->assertJsonPath('data.name', 'سرير كينج 180 سم');
    }

    public function test_can_list_active_payment_methods(): void
    {
        $response = $this->actingAs($this->cashier)
            ->getJson('/api/v1/payment-methods');

        $response->assertOk()
            ->assertJsonFragment(['code' => 'cash']);
    }

    public function test_create_retail_invoice_without_customer_uses_retail_price_default(): void
    {
        $payload = [
            'sale_type' => 'retail',
            'customer_id' => null,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 2,
                    // unit_sale_price omitted -> defaults to retail_price (650.00)
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '1300.00',
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.sale_type', 'retail')
            ->assertJsonPath('data.status', 'posted')
            ->assertJsonPath('data.subtotal', '1300.00')
            ->assertJsonPath('data.total', '1300.00')
            ->assertJsonPath('data.paid_amount', '1300.00')
            ->assertJsonPath('data.remaining_amount', '0.00')
            ->assertJsonPath('data.credit_amount', '0.00');

        // Verify stock deducted from 10 to 8
        $this->product1->refresh();
        $this->assertEquals(8, $this->product1->stock_quantity->toInt());

        // Verify InventoryMovement created
        $movement = InventoryMovement::where('product_id', $this->product1->id)
            ->where('type', InventoryMovementType::SALE->value)
            ->latest('id')
            ->first();

        $this->assertNotNull($movement);
        $this->assertEquals(2, $movement->quantity->toInt());
        $this->assertEquals(8, $movement->resulting_stock->toInt());
        $this->assertEquals('500.00', $movement->unit_cost->toDecimal());

        // Verify historical cost snapshot on invoice item
        $invoice = Invoice::latest('id')->first();
        $item = $invoice->items->first();
        $this->assertEquals('500.00', $item->unit_cost->toDecimal());
        $this->assertEquals('650.00', $item->unit_sale_price->toDecimal());
        $this->assertEquals('1300.00', $item->subtotal->toDecimal());
        $this->assertEquals('1000.00', $item->total_cost->toDecimal());
        $this->assertEquals('300.00', $item->profit->toDecimal());

        // Verify NO customer ledger transactions created for retail sale without customer
        $this->assertDatabaseMissing('customer_transactions', [
            'reference_id' => $invoice->id,
        ]);
    }

    public function test_retail_sale_allows_manual_price_override_without_changing_product_master(): void
    {
        $payload = [
            'sale_type' => 'retail',
            'customer_id' => null,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 1,
                    'unit_sale_price' => '620.00', // Cashier discount override
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '620.00',
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.total', '620.00');

        // Master product prices MUST remain untouched
        $this->product1->refresh();
        $this->assertEquals('650.00', $this->product1->retail_price->toDecimal());
        $this->assertEquals('600.00', $this->product1->wholesale_price->toDecimal());
    }

    public function test_wholesale_sale_strictly_requires_customer(): void
    {
        $payload = [
            'sale_type' => 'wholesale',
            'customer_id' => null, // Missing customer!
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 1,
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['customer_id']);
    }

    public function test_wholesale_sale_defaults_to_wholesale_price_and_integrates_customer_ledger(): void
    {
        // Product 1 wholesale price = 600.00
        $payload = [
            'sale_type' => 'wholesale',
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 3, // Total = 3 * 600 = 1800.00
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '1000.00', // Underpayment: 1000 paid, 800 remaining debt
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.sale_type', 'wholesale')
            ->assertJsonPath('data.total', '1800.00')
            ->assertJsonPath('data.paid_amount', '1000.00')
            ->assertJsonPath('data.remaining_amount', '800.00')
            ->assertJsonPath('data.credit_amount', '0.00');

        $invoice = Invoice::latest('id')->first();

        // Customer ledger check:
        // 1. Invoice DEBIT of 1800.00
        $debitTx = CustomerTransaction::where('customer_id', $this->customer->id)
            ->where('reference_id', $invoice->id)
            ->where('type', CustomerTransactionType::INVOICE->value)
            ->where('direction', CustomerTransactionDirection::DEBIT->value)
            ->first();
        $this->assertNotNull($debitTx);
        $this->assertEquals('1800.00', $debitTx->amount->toDecimal());

        // 2. Payment CREDIT of 1000.00
        $creditTx = CustomerTransaction::where('customer_id', $this->customer->id)
            ->where('reference_id', $invoice->id)
            ->where('type', CustomerTransactionType::PAYMENT->value)
            ->where('direction', CustomerTransactionDirection::CREDIT->value)
            ->first();
        $this->assertNotNull($creditTx);
        $this->assertEquals('1000.00', $creditTx->amount->toDecimal());

        // Net balance: Debits(1800) - Credits(1000) = 800.00 (Customer Debt)
        $this->assertEquals('800.00', $this->customer->calculateBalance()->toDecimal());
    }

    public function test_wholesale_exact_payment_leaves_zero_balance(): void
    {
        $payload = [
            'sale_type' => 'wholesale',
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 1, // 600.00
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '600.00',
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.total', '600.00')
            ->assertJsonPath('data.paid_amount', '600.00')
            ->assertJsonPath('data.remaining_amount', '0.00')
            ->assertJsonPath('data.credit_amount', '0.00');

        // Authoritative balance is 0
        $this->assertEquals('0.00', $this->customer->calculateBalance()->toDecimal());
    }

    public function test_wholesale_overpayment_creates_customer_credit_on_account(): void
    {
        $payload = [
            'sale_type' => 'wholesale',
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 1, // 600.00
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '800.00', // Overpaid by 200.00
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.total', '600.00')
            ->assertJsonPath('data.paid_amount', '800.00')
            ->assertJsonPath('data.remaining_amount', '0.00')
            ->assertJsonPath('data.credit_amount', '200.00');

        // Customer ledger balance: Debits(600) - Credits(800) = -200 (Credit in customer favor)
        $this->assertEquals('-200.00', $this->customer->calculateBalance()->toDecimal());
    }

    public function test_insufficient_stock_rejects_sale_and_rolls_back_everything(): void
    {
        // product2 has 5 in stock. Attempting to sell 6 must fail.
        $payload = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product2->id,
                    'quantity' => 6,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '1320.00',
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['items']);

        // Assert nothing created or mutated
        $this->assertDatabaseCount('invoices', 0);
        $this->assertDatabaseCount('invoice_items', 0);
        $this->assertDatabaseCount('invoice_payments', 0);
        $this->assertDatabaseCount('inventory_movements', 0);

        $this->product2->refresh();
        $this->assertEquals(5, $this->product2->stock_quantity->toInt());
    }

    public function test_historical_cost_and_profit_remain_immutable_when_product_cost_changes(): void
    {
        // 1. Sell product1 at current cost 500, retail price 650, qty 2 => profit = (650 - 500) * 2 = 300
        $payload = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 2,
                    'unit_sale_price' => '650.00',
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '1300.00',
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);
        $response->assertStatus(201);

        $invoice = Invoice::latest('id')->first();
        $item = $invoice->items->first();
        $this->assertEquals('500.00', $item->unit_cost->toDecimal());
        $this->assertEquals('300.00', $item->profit->toDecimal());

        // 2. Product cost now changes in catalog to 600.00
        $this->product1->purchase_cost = 600.00;
        $this->product1->save();

        // 3. Verify old invoice item still snapshots 500.00 and profit 300.00
        $item->refresh();
        $this->assertEquals('500.00', $item->unit_cost->toDecimal());
        $this->assertEquals('300.00', $item->profit->toDecimal());
        $this->assertEquals('300.00', $invoice->calculateTotalProfit()->toDecimal());
    }

    public function test_external_product_creates_expense_and_does_not_mutate_normal_inventory(): void
    {
        $payload = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'external',
                    'product_name' => 'خدادية تطريز يدوي عمولة',
                    'quantity' => 2,
                    'purchase_cost' => '300.00',
                    'unit_sale_price' => '450.00',
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '900.00',
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.total', '900.00');

        // Normal inventory movements must be 0
        $this->assertDatabaseCount('inventory_movements', 0);

        $invoice = Invoice::latest('id')->first();
        $item = $invoice->items->first();
        $this->assertEquals(InvoiceItemType::EXTERNAL, $item->item_type);
        $this->assertNull($item->product_id);
        $this->assertEquals('خدادية تطريز يدوي عمولة', $item->product_name);
        $this->assertEquals('300.00', $item->unit_cost->toDecimal());
        $this->assertEquals('450.00', $item->unit_sale_price->toDecimal());
        $this->assertEquals('900.00', $item->subtotal->toDecimal());
        $this->assertEquals('600.00', $item->total_cost->toDecimal());
        $this->assertEquals('300.00', $item->profit->toDecimal());

        // Expense must be created atomically for 600.00 (external purchase cost)
        $expense = Expense::where('reference_type', InvoiceItem::class)
            ->where('reference_id', $item->id)
            ->first();

        $this->assertNotNull($expense);
        $this->assertEquals('600.00', $expense->amount->toDecimal());
        $this->assertEquals('external_product', $expense->expenseCategory->code);
    }

    public function test_customer_facing_representation_hides_cost_and_profit_from_cashier(): void
    {
        $payload = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 1,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '650.00',
                ],
            ],
        ];

        // Cashier request
        $cashierResponse = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);

        $cashierResponse->assertStatus(201);
        $cashierData = $cashierResponse->json('data');

        // Cashier must NOT receive unit_cost, total_cost, or profit
        $this->assertArrayNotHasKey('total_profit', $cashierData);
        $this->assertArrayNotHasKey('unit_cost', $cashierData['items'][0]);
        $this->assertArrayNotHasKey('total_cost', $cashierData['items'][0]);
        $this->assertArrayNotHasKey('profit', $cashierData['items'][0]);

        // Owner request to view invoice
        $invoiceId = $cashierData['id'];
        $ownerResponse = $this->actingAs($this->owner)
            ->getJson("/api/v1/invoices/{$invoiceId}");

        $ownerResponse->assertOk();
        $ownerData = $ownerResponse->json('data');

        // Owner CAN see profit and historical cost
        $this->assertArrayHasKey('total_profit', $ownerData);
        $this->assertArrayHasKey('unit_cost', $ownerData['items'][0]);
        $this->assertArrayHasKey('profit', $ownerData['items'][0]);
    }

    public function test_checkout_idempotency_prevents_duplicate_invoices_and_mutations(): void
    {
        $payload = [
            'sale_type' => 'retail',
            'idempotency_key' => 'idem-checkout-unique-12345',
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 2,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '1300.00',
                ],
            ],
        ];

        // First submit
        $response1 = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);
        $response1->assertStatus(201);
        $invoiceId = $response1->json('data.id');

        // Second submit with exact same key (simulating double click)
        $response2 = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);
        $response2->assertStatus(200); // or returns original resource
        $this->assertEquals($invoiceId, $response2->json('data.id'));

        // Assert exactly one invoice exists
        $this->assertDatabaseCount('invoices', 1);

        // Assert stock was only deducted once (10 - 2 = 8, NOT 6!)
        $this->product1->refresh();
        $this->assertEquals(8, $this->product1->stock_quantity->toInt());
        $this->assertDatabaseCount('inventory_movements', 1);
        $this->assertDatabaseCount('invoice_payments', 1);
    }

    public function test_invoice_numbers_are_unique_and_sequential(): void
    {
        $payload1 = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 1,
                ],
            ],
            'payments' => [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => '650.00'],
            ],
        ];

        $payload2 = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 1,
                ],
            ],
            'payments' => [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => '650.00'],
            ],
        ];

        $res1 = $this->actingAs($this->cashier)->postJson('/api/v1/invoices', $payload1);
        $res2 = $this->actingAs($this->cashier)->postJson('/api/v1/invoices', $payload2);

        $res1->assertStatus(201);
        $res2->assertStatus(201);

        $num1 = $res1->json('data.invoice_number');
        $num2 = $res2->json('data.invoice_number');

        $this->assertNotEquals($num1, $num2);
        $this->assertMatchesRegularExpression('/^INV-\d{8}-0001$/', $num1);
        $this->assertMatchesRegularExpression('/^INV-\d{8}-0002$/', $num2);
    }

    public function test_unauthenticated_cannot_create_or_view_invoices(): void
    {
        $this->getJson('/api/v1/invoices')->assertStatus(401);
        $this->postJson('/api/v1/invoices', [])->assertStatus(401);
    }

    public function test_wholesale_underpayment_creates_exact_debt_and_customer_ledger_entries(): void
    {
        // Invoice total = 10,000, Payment = 7,000, Remaining = 3,000
        $payload = [
            'sale_type' => 'wholesale',
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 1,
                    'unit_sale_price' => '10000.00',
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '7000.00',
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)
            ->postJson('/api/v1/invoices', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'posted')
            ->assertJsonPath('data.total', '10000.00')
            ->assertJsonPath('data.paid_amount', '7000.00')
            ->assertJsonPath('data.remaining_amount', '3000.00')
            ->assertJsonPath('data.credit_amount', '0.00');

        $invoiceId = $response->json('data.id');

        // Customer ledger contains debit of 10,000
        $this->assertDatabaseHas('customer_transactions', [
            'customer_id' => $this->customer->id,
            'reference_type' => Invoice::class,
            'reference_id' => $invoiceId,
            'type' => CustomerTransactionType::INVOICE->value,
            'direction' => CustomerTransactionDirection::DEBIT->value,
            'amount' => '10000.00',
        ]);

        // Customer ledger contains credit of 7,000
        $this->assertDatabaseHas('customer_transactions', [
            'customer_id' => $this->customer->id,
            'reference_type' => Invoice::class,
            'reference_id' => $invoiceId,
            'type' => CustomerTransactionType::PAYMENT->value,
            'direction' => CustomerTransactionDirection::CREDIT->value,
            'amount' => '7000.00',
        ]);

        // Final customer ledger balance is +3,000 debt
        $this->customer->refresh();
        $this->assertEquals('3000.00', $this->customer->calculateBalance()->toDecimal());

        // Verify no hidden parallel customer balance column exists on the customers table
        $this->assertFalse(Schema::hasColumn('customers', 'balance'));
    }

    public function test_concurrent_sales_cannot_oversell_available_stock(): void
    {
        // Initial stock: 5
        $product = Product::factory()->create([
            'category_id' => $this->category->id,
            'barcode' => 'C0099',
            'stock_quantity' => 5,
            'purchase_cost' => '100.00',
            'wholesale_price' => '150.00',
            'retail_price' => '180.00',
        ]);

        // Two sales attempt: Sale A = 4, Sale B = 4
        $payloadA = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $product->id,
                    'quantity' => 4,
                ],
            ],
            'payments' => [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => '720.00'],
            ],
        ];

        $payloadB = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $product->id,
                    'quantity' => 4,
                ],
            ],
            'payments' => [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => '720.00'],
            ],
        ];

        // Sale A executes and succeeds
        $resA = $this->actingAs($this->cashier)->postJson('/api/v1/invoices', $payloadA);
        $resA->assertStatus(201);

        $product->refresh();
        $this->assertEquals(1, $product->stock_quantity->toInt());

        // Sale B attempts to sell 4 when available stock is now 1:
        // Acquires row lock, re-checks stock (1 < 4), and fails safely
        $resB = $this->actingAs($this->cashier)->postJson('/api/v1/invoices', $payloadB);
        $resB->assertStatus(422)
            ->assertJsonValidationErrors(['items']);

        // Assert stock can never become negative and stays at 1
        $product->refresh();
        $this->assertEquals(1, $product->stock_quantity->toInt());

        // Assert no invoice, payment, or inventory movement was created for Sale B
        $this->assertDatabaseCount('invoices', 1);
        $this->assertDatabaseCount('invoice_payments', 1);
        $this->assertDatabaseCount('inventory_movements', 1);
    }

    public function test_atomic_rollback_on_failure_leaves_no_external_expense_or_invoice(): void
    {
        // Initial state counts
        $initialInvoices = Invoice::count();
        $initialItems = InvoiceItem::count();
        $initialExpenses = Expense::count();
        $initialPayments = Payment::count();
        $initialTransactions = CustomerTransaction::count();
        $initialMovements = InventoryMovement::count();
        $initialStock = $this->product1->stock_quantity->toInt();

        // Hook into Payment creation to throw an exception after external items and expenses have processed
        Payment::creating(function () {
            throw new \RuntimeException('Simulated unexpected failure during payment persistence.');
        });

        $payload = [
            'sale_type' => 'wholesale',
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 1,
                    'unit_sale_price' => '600.00',
                ],
                [
                    'type' => 'external',
                    'product_name' => 'طاولة خاصة مستوردة',
                    'quantity' => 2,
                    'purchase_cost' => '300.00',
                    'unit_sale_price' => '450.00',
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '1500.00',
                ],
            ],
        ];

        try {
            $this->actingAs($this->cashier)->postJson('/api/v1/invoices', $payload);
        } catch (\Throwable $e) {
            // Handled
        }

        // Reset the event listener
        Payment::flushEventListeners();

        // Complete atomic rollback verification: database remains identical to pre-sale state
        $this->assertEquals($initialInvoices, Invoice::count());
        $this->assertEquals($initialItems, InvoiceItem::count());
        $this->assertEquals($initialExpenses, Expense::count());
        $this->assertEquals($initialPayments, Payment::count());
        $this->assertEquals($initialTransactions, CustomerTransaction::count());
        $this->assertEquals($initialMovements, InventoryMovement::count());

        // Normal product stock was not mutated
        $this->product1->refresh();
        $this->assertEquals($initialStock, $this->product1->stock_quantity->toInt());
    }

    public function test_multi_payment_creates_multiple_records_and_rejects_inactive_methods(): void
    {
        $bankMethod = PaymentMethod::create([
            'name' => 'تحويل بنكي',
            'code' => 'bank_transfer',
            'is_cash' => false,
            'is_active' => true,
        ]);

        $inactiveMethod = PaymentMethod::create([
            'name' => 'شيك مصرفي معطل',
            'code' => 'cheque',
            'is_cash' => false,
            'is_active' => false,
        ]);

        // 1. Multi-payment wholesale sale: Total 10,000 (Cash 4,000 + Bank 6,000)
        $payload = [
            'sale_type' => 'wholesale',
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 1,
                    'unit_sale_price' => '10000.00',
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => '4000.00',
                    'notes' => 'دفعة نقدية أولى',
                ],
                [
                    'payment_method_id' => $bankMethod->id,
                    'amount' => '6000.00',
                    'notes' => 'تحويل بنكي باقي الحساب',
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/invoices', $payload);
        $response->assertStatus(201)
            ->assertJsonPath('data.total', '10000.00')
            ->assertJsonPath('data.paid_amount', '10000.00')
            ->assertJsonPath('data.remaining_amount', '0.00')
            ->assertJsonPath('data.credit_amount', '0.00');

        $invoiceId = $response->json('data.id');

        // Two payments created and associated with invoice
        $this->assertDatabaseCount('invoice_payments', 2);
        $this->assertDatabaseHas('invoice_payments', [
            'invoice_id' => $invoiceId,
            'payment_method_id' => $this->cashMethod->id,
            'amount' => '4000.00',
        ]);
        $this->assertDatabaseHas('invoice_payments', [
            'invoice_id' => $invoiceId,
            'payment_method_id' => $bankMethod->id,
            'amount' => '6000.00',
        ]);

        // Customer ledger credits equal 10,000 total (4,000 + 6,000)
        $this->assertDatabaseHas('customer_transactions', [
            'customer_id' => $this->customer->id,
            'reference_id' => $invoiceId,
            'type' => CustomerTransactionType::PAYMENT->value,
            'direction' => CustomerTransactionDirection::CREDIT->value,
            'amount' => '4000.00',
        ]);
        $this->assertDatabaseHas('customer_transactions', [
            'customer_id' => $this->customer->id,
            'reference_id' => $invoiceId,
            'type' => CustomerTransactionType::PAYMENT->value,
            'direction' => CustomerTransactionDirection::CREDIT->value,
            'amount' => '6000.00',
        ]);

        // Customer ledger balance is exactly 0.00 (10,000 debit - 10,000 credit)
        $this->customer->refresh();
        $this->assertEquals('0.00', $this->customer->calculateBalance()->toDecimal());

        // 2. Reject inactive payment method server-side
        $invalidPayload = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => 1,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $inactiveMethod->id,
                    'amount' => '650.00',
                ],
            ],
        ];

        $invalidResponse = $this->actingAs($this->cashier)->postJson('/api/v1/invoices', $invalidPayload);
        $invalidResponse->assertStatus(422)
            ->assertJsonValidationErrors(['payments.0.payment_method_id']);
    }
}
