<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Auth\Enums\UserRole;
use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Customers\Enums\CustomerTransactionType;
use App\Domain\Inventory\Enums\InventoryMovementType;
use App\Domain\Payments\Enums\PaymentType;
use App\Domain\Returns\Enums\SalesReturnResolution;
use App\Domain\Sales\Enums\InvoiceStatus;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerTransaction;
use App\Models\Expense;
use App\Models\InventoryMovement;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\SupplierTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SalesReturnTest extends TestCase
{
    use RefreshDatabase;

    protected User $cashier;

    protected User $owner;

    protected Category $category;

    protected Product $product1;

    protected Product $product2;

    protected Product $product3;

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
            'stock_quantity' => 10,
            'is_active' => true,
        ]);

        $this->product3 = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'مرتبة طبية سوست',
            'barcode' => 'B0003',
            'purchase_cost' => 300.00,
            'wholesale_price' => 400.00,
            'retail_price' => 450.00,
            'stock_quantity' => 10,
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
            ['name' => 'فيزا / كارت', 'is_cash' => false, 'is_active' => true]
        );
    }

    /**
     * Helper to create a posted retail invoice.
     */
    protected function createPostedRetailInvoice(int $qty = 5, ?float $unitPrice = 650.00): Invoice
    {
        $payload = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => $qty,
                    'unit_sale_price' => (string) $unitPrice,
                ],
            ],
            'payments' => [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => (string) ($qty * $unitPrice)],
            ],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/invoices', $payload);
        $response->assertStatus(201);

        return Invoice::find($response->json('data.id'));
    }

    /**
     * Helper to create a posted wholesale invoice.
     */
    protected function createPostedWholesaleInvoice(int $qty = 5, float $paid = 3000.00): Invoice
    {
        $payload = [
            'sale_type' => 'wholesale',
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->product1->id,
                    'quantity' => $qty, // 5 * 600.00 = 3000.00
                ],
            ],
            'payments' => $paid > 0 ? [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => (string) $paid],
            ] : [],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/invoices', $payload);
        $response->assertStatus(201);

        return Invoice::find($response->json('data.id'));
    }

    // 1. Full retail return
    public function test_full_retail_return_with_cash_refund(): void
    {
        $invoice = $this->createPostedRetailInvoice(2, 650.00); // 1,300.00 total
        $item = $invoice->items->first();

        // Stock was 10 - 2 = 8
        $this->assertEquals(8, $this->product1->fresh()->stock_quantity->toInt());

        $payload = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [
                [
                    'invoice_item_id' => $item->id,
                    'quantity' => 2,
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.resolution', 'refund_cash')
            ->assertJsonPath('data.total_return_amount', '1300.00')
            ->assertJsonPath('data.difference_amount', '0.00');

        // Stock restored back to 10
        $this->assertEquals(10, $this->product1->fresh()->stock_quantity->toInt());

        // Refund payment created
        $this->assertDatabaseHas('payments', [
            'payment_type' => PaymentType::REFUND->value,
            'amount' => '1300.00',
        ]);
    }

    // 2. Partial retail return
    public function test_partial_retail_return(): void
    {
        $invoice = $this->createPostedRetailInvoice(5, 650.00); // 5 items sold
        $item = $invoice->items->first();

        $payload = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [
                [
                    'invoice_item_id' => $item->id,
                    'quantity' => 2, // Return 2 of 5
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        $response->assertStatus(201)
            ->assertJsonPath('data.total_return_amount', '1300.00');

        // Remaining returnable quantity is now 3
        $this->assertEquals(3, $item->getRemainingReturnableQuantity());
    }

    // 3. Full wholesale return with account credit
    public function test_full_wholesale_return_with_customer_account_credit(): void
    {
        $invoice = $this->createPostedWholesaleInvoice(5, 3000.00); // 3,000 paid, balance 0
        $item = $invoice->items->first();

        $payload = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::CUSTOMER_ACCOUNT_CREDIT->value,
            'items' => [
                [
                    'invoice_item_id' => $item->id,
                    'quantity' => 5,
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        $response->assertStatus(201)
            ->assertJsonPath('data.total_return_amount', '3000.00');

        // Customer ledger credit created: Balance was 0, now customer has -3000 credit in their favor
        $this->assertEquals('-3000.00', $this->customer->calculateBalance()->toDecimal());
    }

    // 4. Partial wholesale return against unpaid invoice
    public function test_partial_wholesale_return_against_unpaid_invoice(): void
    {
        $invoice = $this->createPostedWholesaleInvoice(5, 0.00); // 0 paid, balance is +3000 debt
        $item = $invoice->items->first();

        $this->assertEquals('3000.00', $this->customer->calculateBalance()->toDecimal());

        $payload = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::CUSTOMER_ACCOUNT_CREDIT->value,
            'items' => [
                [
                    'invoice_item_id' => $item->id,
                    'quantity' => 2, // 2 * 600 = 1,200 return credit
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        $response->assertStatus(201)
            ->assertJsonPath('data.total_return_amount', '1200.00');

        // Customer ledger balance: 3,000 debt - 1,200 return = 1,800 debt
        $this->assertEquals('1800.00', $this->customer->calculateBalance()->toDecimal());
    }

    // 5. Return exceeding remaining quantity is rejected
    public function test_return_exceeding_remaining_quantity_is_rejected(): void
    {
        $invoice = $this->createPostedRetailInvoice(3);
        $item = $invoice->items->first();

        $payload = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [
                [
                    'invoice_item_id' => $item->id,
                    'quantity' => 4, // 4 > 3
                ],
            ],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.quantity']);
    }

    // 6. Return against cancelled invoice is rejected
    public function test_return_against_cancelled_invoice_is_rejected(): void
    {
        $invoice = $this->createPostedRetailInvoice(2);
        $item = $invoice->items->first();

        $invoice->update(['status' => InvoiceStatus::CANCELLED]);

        $payload = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [
                ['invoice_item_id' => $item->id, 'quantity' => 1],
            ],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['invoice_id']);
    }

    // 7. Return against non-existent invoice is rejected
    public function test_return_against_non_existent_invoice_is_rejected(): void
    {
        $payload = [
            'invoice_id' => 999999,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [
                ['invoice_item_id' => 1, 'quantity' => 1],
            ],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['invoice_id']);
    }

    // 8. Multiple returns against the same invoice
    public function test_multiple_returns_against_same_invoice(): void
    {
        $invoice = $this->createPostedRetailInvoice(5);
        $item = $invoice->items->first();

        // First return: 2 units
        $res1 = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 2]],
        ]);
        $res1->assertStatus(201);
        $this->assertEquals(3, $item->getRemainingReturnableQuantity());

        // Second return: 2 units
        $res2 = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 2]],
        ]);
        $res2->assertStatus(201);
        $this->assertEquals(1, $item->getRemainingReturnableQuantity());

        // Third return: 2 units should fail (only 1 remaining)
        $res3 = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 2]],
        ]);
        $res3->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.quantity']);

        // Third return: 1 unit succeeds
        $res4 = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);
        $res4->assertStatus(201);
        $this->assertEquals(0, $item->getRemainingReturnableQuantity());
    }

    // 9. Historical cost is preserved during return
    public function test_historical_cost_is_preserved_during_return_when_product_cost_changes(): void
    {
        $invoice = $this->createPostedRetailInvoice(2, 650.00); // Sold at 650, cost was 500, profit was 150 each
        $item = $invoice->items->first();

        // Now change the current purchase cost of product1 to 600.00
        $this->product1->update(['purchase_cost' => 600.00]);
        $this->assertEquals('600.00', $this->product1->fresh()->purchase_cost->toDecimal());

        // Return 1 unit
        $response = $this->actingAs($this->owner)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);

        $response->assertStatus(201);

        $returnItem = SalesReturnItem::where('invoice_item_id', $item->id)->first();
        // MUST use historical unit cost 500.00, NOT new cost 600.00!
        $this->assertEquals('500.00', $returnItem->unit_cost->toDecimal());
        $this->assertEquals('150.00', $returnItem->profit_reversal->toDecimal());
    }

    // 10. Inventory is restored correctly with sales_return movement
    public function test_inventory_is_restored_correctly_with_sales_return_movement(): void
    {
        $initialStock = $this->product1->stock_quantity->toInt(); // 10
        $invoice = $this->createPostedRetailInvoice(3);
        $this->assertEquals($initialStock - 3, $this->product1->fresh()->stock_quantity->toInt()); // 7
        $item = $invoice->items->first();

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 2]],
        ]);
        $response->assertStatus(201);

        $this->assertEquals(9, $this->product1->fresh()->stock_quantity->toInt());

        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $this->product1->id,
            'type' => InventoryMovementType::SALES_RETURN->value,
            'quantity' => 2,
            'resulting_stock' => 9,
            'reference_type' => SalesReturn::class,
        ]);
    }

    // 11. External product return does not create inventory movement
    public function test_external_product_return_does_not_create_inventory_movement(): void
    {
        // Create invoice with external product
        $salePayload = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'external',
                    'product_name' => 'ستائر مخصصة',
                    'quantity' => 2,
                    'purchase_cost' => '300.00',
                    'unit_sale_price' => '450.00',
                ],
            ],
            'payments' => [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => '900.00'],
            ],
        ];

        $saleRes = $this->actingAs($this->cashier)->postJson('/api/v1/invoices', $salePayload);
        $saleRes->assertStatus(201);
        $invoiceId = $saleRes->json('data.id');
        $invoice = Invoice::find($invoiceId);
        $item = $invoice->items->first();

        $movementsBefore = InventoryMovement::count();

        // Return external product
        $returnRes = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);

        $returnRes->assertStatus(201);

        // Assert NO inventory movement was created for external item
        $this->assertEquals($movementsBefore, InventoryMovement::count());
    }

    // Policy C: External product return preserves original purchase expense without supplier reimbursement
    public function test_external_product_return_preserves_original_purchase_expense_without_supplier_reimbursement(): void
    {
        // 1. Sale of external product (qty 2 * cost 300 = 600 cost; sold at 450 each = 900 revenue)
        $salePayload = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'external',
                    'product_name' => 'ستائر مخصصة يدوياً',
                    'quantity' => 2,
                    'purchase_cost' => '300.00',
                    'unit_sale_price' => '450.00',
                ],
            ],
            'payments' => [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => '900.00'],
            ],
        ];

        $saleRes = $this->actingAs($this->cashier)->postJson('/api/v1/invoices', $salePayload);
        $saleRes->assertStatus(201);
        $invoiceId = $saleRes->json('data.id');
        $invoice = Invoice::find($invoiceId);
        $item = $invoice->items->first();

        // Proves: Sale creates linked purchase expense of 600.00
        $this->assertDatabaseHas('expenses', [
            'reference_type' => InvoiceItem::class,
            'reference_id' => $item->id,
            'amount' => '600.00',
        ]);
        $expense = Expense::where('reference_type', InvoiceItem::class)
            ->where('reference_id', $item->id)
            ->first();
        $this->assertNotNull($expense);

        $initialExpenseCount = Expense::count();
        $initialMovementsCount = InventoryMovement::count();
        $initialSupplierTxCount = SupplierTransaction::count();

        // 2. Customer returns 1 unit via cash refund
        $returnRes = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);
        $returnRes->assertStatus(201);

        // Proves: Returning external product does NOT automatically delete or alter original purchase expense
        $this->assertEquals($initialExpenseCount, Expense::count());
        $freshExpense = $expense->fresh();
        $this->assertNotNull($freshExpense);
        $this->assertEquals('600.00', $freshExpense->amount->toDecimal());

        // Proves: No negative expense is created
        $this->assertDatabaseMissing('expenses', [
            'amount' => '-300.00',
        ]);

        // Proves: Showroom inventory movements are not mutated
        $this->assertEquals($initialMovementsCount, InventoryMovement::count());

        // Proves: No supplier reimbursement or supplier settlement is created by customer return alone
        $this->assertEquals($initialSupplierTxCount, SupplierTransaction::count());

        // Proves: Customer return record created with historical cost snapshot and profit reversal
        $returnItem = SalesReturnItem::where('invoice_item_id', $item->id)->first();
        $this->assertNotNull($returnItem);
        $this->assertEquals('300.00', $returnItem->unit_cost->toDecimal());
        $this->assertEquals('150.00', $returnItem->profit_reversal->toDecimal());

        // Proves: Customer cash refund payment of 450 was created
        $this->assertDatabaseHas('payments', [
            'payment_type' => PaymentType::REFUND->value,
            'amount' => '450.00',
        ]);
    }

    // 12. Cash refund creates refund payment and traces
    public function test_cash_refund_creates_payment_record(): void
    {
        $invoice = $this->createPostedRetailInvoice(1, 650.00);
        $item = $invoice->items->first();

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'payment_method_id' => $this->cashMethod->id,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);

        $response->assertStatus(201);
        $returnId = $response->json('data.id');

        $this->assertDatabaseHas('payments', [
            'payable_type' => SalesReturn::class,
            'payable_id' => $returnId,
            'payment_type' => PaymentType::REFUND->value,
            'amount' => '650.00',
        ]);
    }

    // 13. Equal-value exchange
    public function test_equal_value_exchange(): void
    {
        // Return 1 product1 (650.00) and take 1 product2 (200.00) + 1 product3 (450.00) = 650.00 total
        $invoice = $this->createPostedRetailInvoice(1, 650.00);
        $item = $invoice->items->first();

        $p2Initial = $this->product2->stock_quantity->toInt();
        $p3Initial = $this->product3->stock_quantity->toInt();

        $payload = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::EXCHANGE_EQUAL->value,
            'items' => [
                ['invoice_item_id' => $item->id, 'quantity' => 1],
            ],
            'replacement_items' => [
                ['product_id' => $this->product2->id, 'quantity' => 1, 'unit_sale_price' => '200.00'],
                ['product_id' => $this->product3->id, 'quantity' => 1, 'unit_sale_price' => '450.00'],
            ],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.resolution', 'exchange_equal')
            ->assertJsonPath('data.total_return_amount', '650.00')
            ->assertJsonPath('data.difference_amount', '0.00');

        $replacementInvoiceId = $response->json('data.replacement_invoice_id');
        $this->assertNotNull($replacementInvoiceId);

        // Returned product stock restored
        $this->assertEquals(10, $this->product1->fresh()->stock_quantity->toInt());

        // Replacement products stock deducted
        $this->assertEquals($p2Initial - 1, $this->product2->fresh()->stock_quantity->toInt());
        $this->assertEquals($p3Initial - 1, $this->product3->fresh()->stock_quantity->toInt());
    }

    // 14. Higher-value exchange (upgrade) with difference payment
    public function test_higher_value_exchange_with_difference_payment(): void
    {
        // Return 1 product1 (650.00) and take 2 product3 (450.00 * 2 = 900.00)
        // Difference = 900.00 - 650.00 = 250.00
        $invoice = $this->createPostedRetailInvoice(1, 650.00);
        $item = $invoice->items->first();

        $payload = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::EXCHANGE_UPGRADE->value,
            'difference_payment_method_id' => $this->cashMethod->id,
            'items' => [
                ['invoice_item_id' => $item->id, 'quantity' => 1],
            ],
            'replacement_items' => [
                ['product_id' => $this->product3->id, 'quantity' => 2, 'unit_sale_price' => '450.00'],
            ],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.resolution', 'exchange_upgrade')
            ->assertJsonPath('data.total_return_amount', '650.00')
            ->assertJsonPath('data.difference_amount', '250.00');

        $replacementInvoiceId = $response->json('data.replacement_invoice_id');

        // Verify difference payment recorded for replacement invoice
        $this->assertDatabaseHas('payments', [
            'payable_type' => Invoice::class,
            'payable_id' => $replacementInvoiceId,
            'amount' => '250.00',
            'payment_type' => PaymentType::EXCHANGE_PAYMENT->value,
        ]);
    }

    // 15. Exchange payment difference with inactive payment method is rejected
    public function test_exchange_difference_with_inactive_payment_method_is_rejected(): void
    {
        $inactiveMethod = PaymentMethod::create([
            'name' => 'كاش معطل',
            'code' => 'disabled_cash',
            'is_cash' => true,
            'is_active' => false,
        ]);

        $invoice = $this->createPostedRetailInvoice(1, 650.00);
        $item = $invoice->items->first();

        $payload = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::EXCHANGE_UPGRADE->value,
            'difference_payment_method_id' => $inactiveMethod->id,
            'items' => [
                ['invoice_item_id' => $item->id, 'quantity' => 1],
            ],
            'replacement_items' => [
                ['product_id' => $this->product3->id, 'quantity' => 2, 'unit_sale_price' => '450.00'],
            ],
        ];

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['difference_payment_method_id']);
    }

    // 16. Wholesale customer-account credit reduces debt
    public function test_wholesale_customer_account_credit_reduces_debt(): void
    {
        $invoice = $this->createPostedWholesaleInvoice(5, 1000.00); // 3,000 total, 1,000 paid => 2,000 debt
        $item = $invoice->items->first();

        $this->assertEquals('2000.00', $this->customer->calculateBalance()->toDecimal());

        // Return 2 items (2 * 600 = 1,200)
        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::CUSTOMER_ACCOUNT_CREDIT->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 2]],
        ]);

        $response->assertStatus(201);

        // Debt should be 2,000 - 1,200 = 800
        $this->assertEquals('800.00', $this->customer->calculateBalance()->toDecimal());
    }

    // 17. Return creating customer credit
    public function test_return_creating_customer_credit_beyond_zero(): void
    {
        $invoice = $this->createPostedWholesaleInvoice(5, 3000.00); // 3,000 total, paid in full => 0 debt
        $item = $invoice->items->first();

        // Return 1 item (600.00)
        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::CUSTOMER_ACCOUNT_CREDIT->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);

        $response->assertStatus(201);

        // Balance becomes -600.00 (credit in customer's favor)
        $this->assertEquals('-600.00', $this->customer->calculateBalance()->toDecimal());
    }

    // 18. Customer ledger remains mathematically correct after wholesale cash refund
    public function test_wholesale_cash_refund_preserves_customer_balance(): void
    {
        $invoice = $this->createPostedWholesaleInvoice(5, 3000.00); // Paid in full, balance = 0
        $item = $invoice->items->first();

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 2]],
        ]);

        $response->assertStatus(201);

        // Because cash was handed back to the customer, net balance remains 0!
        $this->assertEquals('0.00', $this->customer->calculateBalance()->toDecimal());
    }

    // 19. Inactive payment method rejected for cash refund
    public function test_inactive_payment_method_rejected_for_cash_refund(): void
    {
        $inactiveMethod = PaymentMethod::create([
            'name' => 'معطل',
            'code' => 'inactive_test',
            'is_cash' => true,
            'is_active' => false,
        ]);

        $invoice = $this->createPostedRetailInvoice(1);
        $item = $invoice->items->first();

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'payment_method_id' => $inactiveMethod->id,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['payment_method_id']);
    }

    // 20. Idempotency prevents duplicate returns
    public function test_idempotency_prevents_duplicate_returns(): void
    {
        $invoice = $this->createPostedRetailInvoice(3);
        $item = $invoice->items->first();
        $idempotencyKey = (string) Str::uuid();

        $payload = [
            'idempotency_key' => $idempotencyKey,
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ];

        $res1 = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        $res1->assertStatus(201);
        $returnId = $res1->json('data.id');

        // Stock was 10 - 3 + 1 = 8
        $this->assertEquals(8, $this->product1->fresh()->stock_quantity->toInt());

        // Second request with same idempotency key
        $res2 = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        $res2->assertStatus(200);
        $this->assertEquals($returnId, $res2->json('data.id'));

        // Stock must still be 8, NOT 9!
        $this->assertEquals(8, $this->product1->fresh()->stock_quantity->toInt());
        $this->assertDatabaseCount('sales_returns', 1);
        $this->assertDatabaseCount('sales_return_items', 1);
    }

    // 21. Return number uniqueness
    public function test_return_numbers_are_unique_and_sequential(): void
    {
        $invoice = $this->createPostedRetailInvoice(4);
        $item = $invoice->items->first();

        $res1 = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);
        $res1->assertStatus(201);

        $res2 = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);
        $res2->assertStatus(201);

        $num1 = $res1->json('data.return_number');
        $num2 = $res2->json('data.return_number');

        $this->assertNotEquals($num1, $num2);
        $this->assertMatchesRegularExpression('/^RET-\d{8}-0001$/', $num1);
        $this->assertMatchesRegularExpression('/^RET-\d{8}-0002$/', $num2);
    }

    // 22. Concurrent returns cannot over-return
    public function test_concurrent_returns_cannot_over_return(): void
    {
        $invoice = $this->createPostedRetailInvoice(5);
        $item = $invoice->items->first();

        // Two return requests for 4 units each on an invoice with 5 units
        $payloadA = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 4]],
        ];

        $payloadB = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 4]],
        ];

        // Return A succeeds (returned 4, remaining 1)
        $resA = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payloadA);
        $resA->assertStatus(201);

        // Return B fails safely
        $resB = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payloadB);
        $resB->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.quantity']);

        // Assert exactly one return exists
        $this->assertDatabaseCount('sales_returns', 1);
        $this->assertEquals(1, $item->getRemainingReturnableQuantity());
    }

    // 23. Atomic rollback on failure
    public function test_atomic_rollback_on_failure_leaves_no_return_records(): void
    {
        $invoice = $this->createPostedRetailInvoice(2);
        $item = $invoice->items->first();

        // Hook Payment creating to fail
        Payment::creating(function () {
            throw new \RuntimeException('Simulated payment failure during refund.');
        });

        $payload = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ];

        try {
            $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        } catch (\Throwable) {
            // Handled
        }

        Payment::flushEventListeners();

        // Entire database rolls back
        $this->assertDatabaseCount('sales_returns', 0);
        $this->assertDatabaseCount('sales_return_items', 0);
        $this->assertEquals(8, $this->product1->fresh()->stock_quantity->toInt());
    }

    // 24. Audit event creation
    public function test_return_creates_audit_log_record(): void
    {
        $invoice = $this->createPostedRetailInvoice(1);
        $item = $invoice->items->first();

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);
        $response->assertStatus(201);
        $returnId = $response->json('data.id');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'return_created',
            'auditable_type' => SalesReturn::class,
            'auditable_id' => $returnId,
            'user_id' => $this->cashier->id,
        ]);
    }

    // 25. Cashier cannot access owner-only financial information
    public function test_cashier_cannot_access_owner_only_financial_information(): void
    {
        $invoice = $this->createPostedRetailInvoice(2);
        $item = $invoice->items->first();

        $createRes = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);
        $createRes->assertStatus(201);
        $returnId = $createRes->json('data.id');

        // Cashier viewing return
        $cashierView = $this->actingAs($this->cashier)->getJson("/api/v1/returns/{$returnId}");
        $cashierView->assertStatus(200)
            ->assertJsonMissingPath('data.total_profit_reversed')
            ->assertJsonMissingPath('data.items.0.unit_cost')
            ->assertJsonMissingPath('data.items.0.profit_reversal');

        // Owner viewing return sees confidential profit metrics
        $ownerView = $this->actingAs($this->owner)->getJson("/api/v1/returns/{$returnId}");
        $ownerView->assertStatus(200)
            ->assertJsonPath('data.total_profit_reversed', '150.00')
            ->assertJsonPath('data.items.0.unit_cost', '500.00')
            ->assertJsonPath('data.items.0.profit_reversal', '150.00');
    }

    // --- Phase 5.1 Financial Integrity Audit Tests ---

    // Audit 1.1: Wholesale cash refund when original invoice is unpaid
    public function test_wholesale_cash_refund_when_invoice_is_unpaid_asserting_exact_ledger_entries(): void
    {
        $invoice = $this->createPostedWholesaleInvoice(5, 0.00); // 3,000 total, 0 paid => 3,000 debt
        $item = $invoice->items->first();

        $this->assertEquals('3000.00', $this->customer->calculateBalance()->toDecimal());
        $this->assertEquals(1, $this->customer->transactions()->count());

        // Return 2 units worth 1,200 via REFUND_CASH
        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 2]],
        ]);
        $response->assertStatus(201);

        $transactions = $this->customer->transactions()->orderBy('id')->get();
        $this->assertCount(3, $transactions);

        // Entry 1: Original Invoice (Debit 3,000)
        $this->assertEquals(CustomerTransactionType::INVOICE, $transactions[0]->type);
        $this->assertEquals(CustomerTransactionDirection::DEBIT, $transactions[0]->direction);
        $this->assertEquals('3000.00', $transactions[0]->amount->toDecimal());

        // Entry 2: Return Merchandise (Credit 1,200)
        $this->assertEquals(CustomerTransactionType::RETURN, $transactions[1]->type);
        $this->assertEquals(CustomerTransactionDirection::CREDIT, $transactions[1]->direction);
        $this->assertEquals('1200.00', $transactions[1]->amount->toDecimal());

        // Entry 3: Cash Refund Payout (Debit 1,200)
        $this->assertEquals(CustomerTransactionType::REFUND, $transactions[2]->type);
        $this->assertEquals(CustomerTransactionDirection::DEBIT, $transactions[2]->direction);
        $this->assertEquals('1200.00', $transactions[2]->amount->toDecimal());

        // Net balance remains exactly 3,000 debt (no unearned credit created)
        $this->assertEquals('3000.00', $this->customer->calculateBalance()->toDecimal());

        // Payment record of type refund exists
        $this->assertDatabaseHas('payments', [
            'payment_type' => PaymentType::REFUND->value,
            'amount' => '1200.00',
        ]);
    }

    // Audit 1.2: Wholesale cash refund when original invoice is partially paid
    public function test_wholesale_cash_refund_when_invoice_is_partially_paid_asserting_exact_ledger_entries(): void
    {
        $invoice = $this->createPostedWholesaleInvoice(5, 1000.00); // 3,000 total, 1,000 paid => 2,000 debt
        $item = $invoice->items->first();

        $this->assertEquals('2000.00', $this->customer->calculateBalance()->toDecimal());
        $this->assertEquals(2, $this->customer->transactions()->count());

        // Return 2 units worth 1,200 via REFUND_CASH
        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 2]],
        ]);
        $response->assertStatus(201);

        $transactions = $this->customer->transactions()->orderBy('id')->get();
        $this->assertCount(4, $transactions);

        // Entry 1: Invoice Debit 3000
        $this->assertEquals(CustomerTransactionType::INVOICE, $transactions[0]->type);
        $this->assertEquals('3000.00', $transactions[0]->amount->toDecimal());

        // Entry 2: Payment Credit 1000
        $this->assertEquals(CustomerTransactionType::PAYMENT, $transactions[1]->type);
        $this->assertEquals('1000.00', $transactions[1]->amount->toDecimal());

        // Entry 3: Return Credit 1200
        $this->assertEquals(CustomerTransactionType::RETURN, $transactions[2]->type);
        $this->assertEquals('1200.00', $transactions[2]->amount->toDecimal());

        // Entry 4: Refund Debit 1200
        $this->assertEquals(CustomerTransactionType::REFUND, $transactions[3]->type);
        $this->assertEquals('1200.00', $transactions[3]->amount->toDecimal());

        // Net balance remains exactly 2,000 debt
        $this->assertEquals('2000.00', $this->customer->calculateBalance()->toDecimal());
    }

    // Audit 1.3: Wholesale cash refund when original invoice is fully paid
    public function test_wholesale_cash_refund_when_invoice_is_fully_paid_asserting_exact_ledger_entries(): void
    {
        $invoice = $this->createPostedWholesaleInvoice(5, 3000.00); // 3,000 total, 3,000 paid => 0 debt
        $item = $invoice->items->first();

        $this->assertEquals('0.00', $this->customer->calculateBalance()->toDecimal());
        $this->assertEquals(2, $this->customer->transactions()->count());

        // Return 1 unit worth 600 via REFUND_CASH
        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);
        $response->assertStatus(201);

        $transactions = $this->customer->transactions()->orderBy('id')->get();
        $this->assertCount(4, $transactions);

        $this->assertEquals(CustomerTransactionType::RETURN, $transactions[2]->type);
        $this->assertEquals(CustomerTransactionDirection::CREDIT, $transactions[2]->direction);
        $this->assertEquals('600.00', $transactions[2]->amount->toDecimal());

        $this->assertEquals(CustomerTransactionType::REFUND, $transactions[3]->type);
        $this->assertEquals(CustomerTransactionDirection::DEBIT, $transactions[3]->direction);
        $this->assertEquals('600.00', $transactions[3]->amount->toDecimal());

        // Net balance remains strictly 0
        $this->assertEquals('0.00', $this->customer->calculateBalance()->toDecimal());
    }

    // Audit 1.4: Wholesale cash refund when customer already has credit balance
    public function test_wholesale_cash_refund_when_customer_already_has_credit_balance(): void
    {
        // Add prior standalone credit on account (-500.00)
        CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::CREDIT,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => Money::from(500),
            'description' => 'رصيد دائن سابق للعميل',
        ]);
        $this->assertEquals('-500.00', $this->customer->calculateBalance()->toDecimal());

        // Create fully paid wholesale invoice for 600
        $invoice = $this->createPostedWholesaleInvoice(1, 600.00);
        $item = $invoice->items->first();
        $this->assertEquals('-500.00', $this->customer->calculateBalance()->toDecimal());

        // Return 1 unit via REFUND_CASH
        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
        ]);
        $response->assertStatus(201);

        // Balance remains strictly -500.00 (cash was disbursed, so credit is not double-counted)
        $this->assertEquals('-500.00', $this->customer->calculateBalance()->toDecimal());
    }

    // Audit 2.1: Wholesale exchange upgrade end-to-end ledger and inventory equilibrium
    public function test_wholesale_exchange_upgrade_end_to_end_ledger_and_inventory_equilibrium(): void
    {
        $invoice = $this->createPostedWholesaleInvoice(1, 600.00); // 1 unit product1, fully paid
        $item = $invoice->items->first();

        $initialStockProduct1 = $this->product1->fresh()->stock_quantity->toInt(); // 9
        $initialStockProduct3 = $this->product3->fresh()->stock_quantity->toInt(); // 10

        // Exchange: Return 1 unit product1 (600.00), take 2 units product3 (2 * 450 = 900.00)
        // Difference = 300.00
        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::EXCHANGE_UPGRADE->value,
            'difference_payment_method_id' => $this->cashMethod->id,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
            'replacement_items' => [
                ['product_id' => $this->product3->id, 'quantity' => 2, 'unit_sale_price' => '450.00'],
            ],
        ]);
        $response->assertStatus(201);

        $returnId = $response->json('data.id');
        $replacementInvId = $response->json('data.replacement_invoice_id');

        // Stock checks:
        // Product 1 returned: 9 + 1 = 10
        $this->assertEquals($initialStockProduct1 + 1, $this->product1->fresh()->stock_quantity->toInt());
        // Product 3 replacement: 10 - 2 = 8
        $this->assertEquals($initialStockProduct3 - 2, $this->product3->fresh()->stock_quantity->toInt());

        // Inventory movements:
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $this->product1->id,
            'type' => InventoryMovementType::SALES_RETURN->value,
            'quantity' => 1,
            'reference_type' => SalesReturn::class,
            'reference_id' => $returnId,
        ]);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $this->product3->id,
            'type' => InventoryMovementType::SALE->value,
            'quantity' => 2,
            'reference_type' => Invoice::class,
            'reference_id' => $replacementInvId,
        ]);

        // Customer ledger checks:
        // 1. Return merchandise Credit 600
        $this->assertDatabaseHas('customer_transactions', [
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::RETURN->value,
            'direction' => CustomerTransactionDirection::CREDIT->value,
            'amount' => '600.00',
            'reference_type' => SalesReturn::class,
            'reference_id' => $returnId,
        ]);
        // 2. Replacement invoice Debit 900
        $this->assertDatabaseHas('customer_transactions', [
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::INVOICE->value,
            'direction' => CustomerTransactionDirection::DEBIT->value,
            'amount' => '900.00',
            'reference_type' => Invoice::class,
            'reference_id' => $replacementInvId,
        ]);
        // 3. Difference payment Credit 300
        $this->assertDatabaseHas('customer_transactions', [
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::PAYMENT->value,
            'direction' => CustomerTransactionDirection::CREDIT->value,
            'amount' => '300.00',
            'reference_type' => Invoice::class,
            'reference_id' => $replacementInvId,
        ]);

        // Net balance: -600 + 900 - 300 = 0. Customer is never charged twice!
        $this->assertEquals('0.00', $this->customer->calculateBalance()->toDecimal());
    }

    // Audit 2.2: Equal exchange requires zero payment difference
    public function test_equal_exchange_requires_zero_additional_payment(): void
    {
        $invoice = $this->createPostedRetailInvoice(2); // 2 units product1 @ 650 = 1300
        $item = $invoice->items->first();

        // Product2 wholesale/retail prices: set price to 650
        $this->product2->update(['retail_price' => 650.00]);

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::EXCHANGE_EQUAL->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 2]],
            'replacement_items' => [
                ['product_id' => $this->product2->id, 'quantity' => 2, 'unit_sale_price' => '650.00'],
            ],
        ]);

        $response->assertStatus(201);
        $this->assertEquals('0.00', $response->json('data.difference_amount'));
        // No exchange payment should be recorded
        $this->assertDatabaseMissing('payments', [
            'payment_type' => PaymentType::EXCHANGE_PAYMENT->value,
        ]);
    }

    // Audit 2.3: Lower value replacement is strictly rejected
    public function test_exchange_with_lower_value_replacement_is_strictly_rejected(): void
    {
        $invoice = $this->createPostedRetailInvoice(2); // 2 * 650 = 1300
        $item = $invoice->items->first();

        // Attempt EQUAL exchange with 1 item of 450 (450 != 1300)
        $resEqual = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::EXCHANGE_EQUAL->value,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 2]],
            'replacement_items' => [
                ['product_id' => $this->product3->id, 'quantity' => 1, 'unit_sale_price' => '450.00'],
            ],
        ]);
        $resEqual->assertStatus(422)
            ->assertJsonValidationErrors(['replacement_items']);

        // Attempt UPGRADE exchange with 1 item of 450 (450 < 1300)
        $resUpgrade = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::EXCHANGE_UPGRADE->value,
            'difference_payment_method_id' => $this->cashMethod->id,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 2]],
            'replacement_items' => [
                ['product_id' => $this->product3->id, 'quantity' => 1, 'unit_sale_price' => '450.00'],
            ],
        ]);
        $resUpgrade->assertStatus(422)
            ->assertJsonValidationErrors(['replacement_items']);
    }

    // Audit 3.1: Idempotency key reuse across different invoices is rejected
    public function test_idempotency_key_reuse_across_different_invoices_is_rejected(): void
    {
        $invoice1 = $this->createPostedRetailInvoice(2);
        $invoice2 = $this->createPostedRetailInvoice(2);
        $item1 = $invoice1->items->first();
        $item2 = $invoice2->items->first();

        $sharedKey = 'test-idemp-cross-invoice-key';

        // 1. Submit return on invoice 1 with sharedKey
        $res1 = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'idempotency_key' => $sharedKey,
            'invoice_id' => $invoice1->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item1->id, 'quantity' => 1]],
        ]);
        $res1->assertStatus(201);

        // 2. Submit return on invoice 2 with the same sharedKey
        $res2 = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'idempotency_key' => $sharedKey,
            'invoice_id' => $invoice2->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [['invoice_item_id' => $item2->id, 'quantity' => 1]],
        ]);
        $res2->assertStatus(422)
            ->assertJsonValidationErrors(['idempotency_key']);
    }

    // Audit 3.2: Idempotency retry on exchange does not duplicate stock or payments
    public function test_idempotency_retry_on_exchange_does_not_duplicate_stock_or_payments(): void
    {
        $invoice = $this->createPostedRetailInvoice(1);
        $item = $invoice->items->first();
        $idempKey = 'idemp-exchange-replay-test';

        $payload = [
            'idempotency_key' => $idempKey,
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::EXCHANGE_UPGRADE->value,
            'difference_payment_method_id' => $this->cashMethod->id,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
            'replacement_items' => [
                ['product_id' => $this->product3->id, 'quantity' => 2, 'unit_sale_price' => '450.00'],
            ],
        ];

        // First attempt (creates return)
        $res1 = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        $res1->assertStatus(201);

        $returnsCount = SalesReturn::count();
        $replacementInvoicesCount = Invoice::count();
        $stockP1 = $this->product1->fresh()->stock_quantity->toInt();
        $stockP3 = $this->product3->fresh()->stock_quantity->toInt();
        $paymentsCount = Payment::count();

        // Second attempt with same idempotency key (retrieves existing return)
        $res2 = $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        $res2->assertStatus(200);
        $this->assertEquals($res1->json('data.id'), $res2->json('data.id'));

        // Assert zero duplicated side-effects
        $this->assertEquals($returnsCount, SalesReturn::count());
        $this->assertEquals($replacementInvoicesCount, Invoice::count());
        $this->assertEquals($stockP1, $this->product1->fresh()->stock_quantity->toInt());
        $this->assertEquals($stockP3, $this->product3->fresh()->stock_quantity->toInt());
        $this->assertEquals($paymentsCount, Payment::count());
    }

    // Audit 6.1: Exchange failure injection rolls back entire transaction
    public function test_exchange_atomic_rollback_on_failure_leaves_no_traces(): void
    {
        $invoice = $this->createPostedRetailInvoice(1);
        $item = $invoice->items->first();

        $initialStockP1 = $this->product1->fresh()->stock_quantity->toInt();
        $initialStockP3 = $this->product3->fresh()->stock_quantity->toInt();

        // Hook InvoicePayment creating to fail midway
        InvoicePayment::creating(function () {
            throw new \RuntimeException('Simulated failure during invoice payment recording.');
        });

        $payload = [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::EXCHANGE_UPGRADE->value,
            'difference_payment_method_id' => $this->cashMethod->id,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
            'replacement_items' => [
                ['product_id' => $this->product3->id, 'quantity' => 2, 'unit_sale_price' => '450.00'],
            ],
        ];

        try {
            $this->actingAs($this->cashier)->postJson('/api/v1/returns', $payload);
        } catch (\Throwable) {
            // Handled
        }

        InvoicePayment::flushEventListeners();

        // Assert full rollback
        $this->assertDatabaseCount('sales_returns', 0);
        $this->assertDatabaseCount('sales_return_items', 0);
        $this->assertDatabaseCount('invoices', 1); // Only original invoice remains
        $this->assertDatabaseCount('payments', 1); // Only original invoice payment remains
        $this->assertDatabaseCount('invoice_payments', 1); // Only original invoice payment remains
        $this->assertDatabaseMissing('payments', [
            'payment_type' => PaymentType::EXCHANGE_PAYMENT->value,
        ]);

        // Stock remains untouched
        $this->assertEquals($initialStockP1, $this->product1->fresh()->stock_quantity->toInt());
        $this->assertEquals($initialStockP3, $this->product3->fresh()->stock_quantity->toInt());

        // Zero sales_return movements
        $this->assertDatabaseMissing('inventory_movements', [
            'type' => InventoryMovementType::SALES_RETURN->value,
        ]);
    }

    // Audit 5.1: Cashier cannot access confidential cost/profit metrics on replacement invoice
    public function test_cashier_cannot_access_cost_metrics_on_replacement_invoice(): void
    {
        $invoice = $this->createPostedRetailInvoice(1);
        $item = $invoice->items->first();

        $response = $this->actingAs($this->cashier)->postJson('/api/v1/returns', [
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::EXCHANGE_UPGRADE->value,
            'difference_payment_method_id' => $this->cashMethod->id,
            'items' => [['invoice_item_id' => $item->id, 'quantity' => 1]],
            'replacement_items' => [
                ['product_id' => $this->product3->id, 'quantity' => 2, 'unit_sale_price' => '450.00'],
            ],
        ]);
        $response->assertStatus(201);
        $replacementInvId = $response->json('data.replacement_invoice_id');

        // Cashier viewing replacement invoice
        $cashierView = $this->actingAs($this->cashier)->getJson("/api/v1/invoices/{$replacementInvId}");
        $cashierView->assertStatus(200)
            ->assertJsonMissingPath('data.items.0.unit_cost')
            ->assertJsonMissingPath('data.items.0.total_cost')
            ->assertJsonMissingPath('data.items.0.profit');

        // Owner viewing replacement invoice sees internal financial metrics
        $ownerView = $this->actingAs($this->owner)->getJson("/api/v1/invoices/{$replacementInvId}");
        $ownerView->assertStatus(200)
            ->assertJsonPath('data.items.0.unit_cost', $this->product3->purchase_cost->toDecimal())
            ->assertJsonPath('data.items.0.total_cost', '600.00')
            ->assertJsonPath('data.items.0.profit', '300.00');
    }
}
