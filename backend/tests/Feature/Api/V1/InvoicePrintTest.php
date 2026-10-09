<?php

namespace Tests\Feature\Api\V1;

use App\Actions\Sales\CreateInvoiceAction;
use App\Domain\Auth\Enums\UserRole;
use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Customers\Enums\CustomerTransactionType;
use App\Domain\Sales\Enums\SaleType;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerTransaction;
use App\Models\Invoice;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoicePrintTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $cashier;

    private PaymentMethod $cashMethod;

    private Category $category;

    private Product $quilt;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => UserRole::OWNER,
            'is_active' => true,
        ]);

        $this->cashier = User::factory()->create([
            'role' => UserRole::CASHIER,
            'is_active' => true,
        ]);

        $this->cashMethod = PaymentMethod::firstOrCreate(
            ['code' => 'cash'],
            ['name' => 'نقدي كاش', 'is_cash' => true, 'is_active' => true]
        );

        $this->category = Category::factory()->create([
            'name' => 'مفروشات',
            'code' => 'M',
            'is_active' => true,
        ]);

        $this->quilt = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'طقم لحاف مطرز 6 قطع',
            'barcode' => 'M0001',
            'purchase_cost' => 500.00,
            'wholesale_price' => 700.00,
            'retail_price' => 900.00,
            'stock_quantity' => 20,
            'is_active' => true,
        ]);

        $this->customer = Customer::factory()->create([
            'name' => 'معرض النور للمفروشات',
            'phone' => '01012345678',
            'address' => 'دمياط - شارع التجاريين',
            'is_active' => true,
        ]);
    }

    public function test_anonymous_retail_invoice_printing(): void
    {
        $action = app(CreateInvoiceAction::class);
        $invoice = $action->execute([
            'sale_type' => SaleType::RETAIL->value,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 2,
                    'unit_price' => 900.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 1800.00,
                ],
            ],
        ], $this->cashier);

        $res = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        $res->assertOk()
            ->assertJsonPath('data.invoice_number', $invoice->invoice_number)
            ->assertJsonPath('data.sale_type', 'retail')
            ->assertJsonPath('data.sale_type_label', 'قطاعي')
            ->assertJsonPath('data.customer', null)
            ->assertJsonPath('data.total', '1800.00')
            ->assertJsonPath('data.paid_amount', '1800.00')
            ->assertJsonPath('data.remaining_amount', '0.00')
            ->assertJsonPath('data.showroom.name', 'العالمية للأثاث والموبيليا')
            ->assertJsonPath('data.items.0.product_name', 'طقم لحاف مطرز 6 قطع')
            ->assertJsonPath('data.items.0.quantity', 2)
            ->assertJsonPath('data.items.0.unit_price', '900.00')
            ->assertJsonPath('data.items.0.subtotal', '1800.00');

        // Check return policy is present
        $this->assertNotEmpty($res->json('data.showroom.return_policy'));
    }

    public function test_wholesale_invoice_with_outstanding_debt_shows_prior_and_resulting_balance(): void
    {
        $action = app(CreateInvoiceAction::class);
        // Total 2 * 700 = 1400. Paid 1000. Debt 400.
        $invoice = $action->execute([
            'sale_type' => SaleType::WHOLESALE->value,
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 2,
                    'unit_price' => 700.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 1000.00,
                ],
            ],
        ], $this->cashier);

        $res = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        $res->assertOk()
            ->assertJsonPath('data.sale_type', 'wholesale')
            ->assertJsonPath('data.is_wholesale', true)
            ->assertJsonPath('data.customer.name', 'معرض النور للمفروشات')
            ->assertJsonPath('data.customer.prior_balance', '0.00')
            ->assertJsonPath('data.customer.resulting_balance', '400.00')
            ->assertJsonPath('data.total', '1400.00')
            ->assertJsonPath('data.paid_amount', '1000.00')
            ->assertJsonPath('data.remaining_amount', '400.00')
            ->assertJsonPath('data.credit_amount', '0.00');
    }

    public function test_wholesale_invoice_with_overpayment_creates_credit_balance(): void
    {
        $action = app(CreateInvoiceAction::class);
        // Total 1 * 700 = 700. Paid 1000. Excess 300 becomes customer credit.
        $invoice = $action->execute([
            'sale_type' => SaleType::WHOLESALE->value,
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 1,
                    'unit_price' => 700.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 1000.00,
                ],
            ],
        ], $this->cashier);

        $res = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        $res->assertOk()
            ->assertJsonPath('data.total', '700.00')
            ->assertJsonPath('data.paid_amount', '1000.00')
            ->assertJsonPath('data.credit_amount', '300.00')
            ->assertJsonPath('data.customer.resulting_balance', '-300.00');
    }

    public function test_external_product_appears_as_ordinary_line_without_leaking_cost_or_markers(): void
    {
        $action = app(CreateInvoiceAction::class);
        // External product with cost 300, sold for 450
        $invoice = $action->execute([
            'sale_type' => SaleType::RETAIL->value,
            'items' => [
                [
                    'type' => 'external',
                    'product_name' => 'مخدة تفصيل تطريز سوري',
                    'quantity' => 2,
                    'purchase_cost' => 300.00,
                    'unit_sale_price' => 450.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 900.00,
                ],
            ],
        ], $this->cashier);

        $res = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        $res->assertOk();
        $item = $res->json('data.items.0');

        // Customer sees regular line item
        $this->assertEquals('مخدة تفصيل تطريز سوري', $item['product_name']);
        $this->assertEquals(2, $item['quantity']);
        $this->assertEquals('450.00', $item['unit_price']);
        $this->assertEquals('900.00', $item['subtotal']);

        // Mandatory confidentiality checks
        $this->assertArrayNotHasKey('unit_cost', $item);
        $this->assertArrayNotHasKey('total_cost', $item);
        $this->assertArrayNotHasKey('profit', $item);
        $this->assertArrayNotHasKey('item_type', $item);
        $this->assertArrayNotHasKey('expense_id', $item);
        $this->assertArrayNotHasKey('is_external', $item);
    }

    public function test_confidentiality_cost_and_profit_are_never_exposed_on_customer_printable_resource(): void
    {
        $action = app(CreateInvoiceAction::class);
        $invoice = $action->execute([
            'sale_type' => SaleType::RETAIL->value,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 1,
                    'unit_price' => 900.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 900.00,
                ],
            ],
        ], $this->cashier);

        $forbiddenKeys = [
            'purchase_cost',
            'unit_cost',
            'total_cost',
            'profit',
            'expense_id',
            'is_external',
            'item_type',
        ];

        // Test with Owner user
        $ownerRes = $this->actingAs($this->owner, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));
        $ownerRes->assertOk();
        $this->assertArrayNotHasKey('total_profit', $ownerRes->json('data'));
        foreach ($forbiddenKeys as $key) {
            $this->assertArrayNotHasKey($key, $ownerRes->json('data'));
            $this->assertArrayNotHasKey($key, $ownerRes->json('data.items.0'));
        }

        // Test with Cashier user
        $cashierRes = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));
        $cashierRes->assertOk();
        $this->assertArrayNotHasKey('total_profit', $cashierRes->json('data'));
        foreach ($forbiddenKeys as $key) {
            $this->assertArrayNotHasKey($key, $cashierRes->json('data'));
            $this->assertArrayNotHasKey($key, $cashierRes->json('data.items.0'));
        }
    }

    public function test_wholesale_invoice_retains_historical_prior_and_resulting_balances_regardless_of_later_transactions(): void
    {
        // 1. Customer has a previous debt of 1,000.
        CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => 1000.00,
            'description' => 'رصيد سابق افتتاحي',
            'created_by' => $this->owner->id,
        ]);
        $this->assertEquals('1000.00', $this->customer->calculateBalance()->toDecimal());

        // 2. Customer posts an invoice for 400 and pays 200.
        $this->quilt->update(['wholesale_price' => 400.00]);
        $action = app(CreateInvoiceAction::class);
        $invoice = $action->execute([
            'sale_type' => SaleType::WHOLESALE->value,
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 1,
                    'unit_price' => 400.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 200.00,
                ],
            ],
        ], $this->cashier);

        // 3. The resulting debt at invoice time is 1,200.
        $resInitial = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        $resInitial->assertOk()
            ->assertJsonPath('data.customer.prior_balance', '1000.00')
            ->assertJsonPath('data.total', '400.00')
            ->assertJsonPath('data.paid_amount', '200.00')
            ->assertJsonPath('data.remaining_amount', '200.00')
            ->assertJsonPath('data.customer.resulting_balance', '1200.00')
            ->assertJsonPath('data.customer.balance_status', 'مدين (مستحق على العميل)');

        // 4. Later transactions change the customer’s balance (e.g. customer settles debt with 1,200 payment).
        CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::PAYMENT,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => 1200.00,
            'description' => 'سداد لاحق بعد أيام من الفاتورة',
            'created_by' => $this->cashier->id,
        ]);
        // Live customer balance is now 0.00
        $this->assertEquals('0.00', $this->customer->calculateBalance()->toDecimal());

        // 5. Reprinting the original invoice MUST still present the correct invoice-time figures:
        // prior_balance: 1000.00, resulting_balance: 1200.00
        $resReprint = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        $resReprint->assertOk()
            ->assertJsonPath('data.customer.prior_balance', '1000.00')
            ->assertJsonPath('data.customer.resulting_balance', '1200.00')
            ->assertJsonPath('data.customer.balance_status', 'مدين (مستحق على العميل)');

        // Also check regular invoice endpoint InvoiceResource retains prior and resulting balance while reflecting current_balance
        $resInvoice = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.show', $invoice));

        $resInvoice->assertOk()
            ->assertJsonPath('data.customer.prior_balance', '1000.00')
            ->assertJsonPath('data.customer.resulting_balance', '1200.00')
            ->assertJsonPath('data.customer.current_balance', '0.00');
    }

    public function test_back_dated_payment_with_higher_id_is_included_in_previous_balance(): void
    {
        // 1. Initial debt of 1000 at 2026-10-01 for home textiles
        Carbon::setTestNow(Carbon::parse('2026-10-01 10:00:00'));
        $initialTx = CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => 1000.00,
            'description' => 'رصيد سابق فاتورة مفروشات',
            'created_by' => $this->owner->id,
        ]);
        $initialTx->forceFill([
            'created_at' => Carbon::parse('2026-10-01 10:00:00'),
            'updated_at' => Carbon::parse('2026-10-01 10:00:00'),
        ])->save();

        // 2. Invoice created at 2026-10-05: total 400, paid 100
        Carbon::setTestNow(Carbon::parse('2026-10-05 10:00:00'));
        $this->quilt->update(['wholesale_price' => 400.00]);
        $action = app(CreateInvoiceAction::class);
        $invoice = $action->execute([
            'sale_type' => SaleType::WHOLESALE->value,
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 1,
                    'unit_price' => 400.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 100.00,
                ],
            ],
        ], $this->cashier);

        // 3. Late-entered back-dated payment (created later in real time / higher ID, but dated 2026-10-03 before invoice)
        Carbon::setTestNow(Carbon::parse('2026-10-09 10:00:00'));
        $paymentTx = CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::PAYMENT,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => 300.00,
            'description' => 'سداد نقدي متأخر الإدخال مؤرخ بتاريخ سابق',
            'created_by' => $this->cashier->id,
        ]);
        $paymentTx->forceFill([
            'created_at' => Carbon::parse('2026-10-03 12:00:00'),
            'updated_at' => Carbon::parse('2026-10-03 12:00:00'),
        ])->save();

        Carbon::setTestNow();

        $invoiceTxMinId = CustomerTransaction::where('reference_type', Invoice::class)
            ->where('reference_id', $invoice->id)
            ->min('id');
        $this->assertGreaterThan($invoiceTxMinId, $paymentTx->id);

        // 4. Print invoice: previous balance must incorporate the back-dated payment (1000 - 300 = 700.00)
        // and resulting balance must be 700 + (400 - 100) = 1000.00
        $res = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        $res->assertOk()
            ->assertJsonPath('data.customer.prior_balance', '700.00')
            ->assertJsonPath('data.total', '400.00')
            ->assertJsonPath('data.paid_amount', '100.00')
            ->assertJsonPath('data.remaining_amount', '300.00')
            ->assertJsonPath('data.customer.resulting_balance', '1000.00');
    }

    public function test_late_created_transaction_with_lower_id_but_future_date_is_not_included_in_previous_balance(): void
    {
        // 1. Transaction inserted with lower ID, but dated in the future (2026-10-10)
        $futureTx = CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => 800.00,
            'description' => 'معاملة مسجلة مسبقاً برقم تعريف أدنى ومؤرخة بتاريخ لاحق',
            'created_by' => $this->owner->id,
        ]);
        $futureTx->forceFill([
            'created_at' => Carbon::parse('2026-10-10 10:00:00'),
            'updated_at' => Carbon::parse('2026-10-10 10:00:00'),
        ])->save();

        // 2. Invoice created at 2026-10-05 (higher transaction IDs, but earlier event time)
        Carbon::setTestNow(Carbon::parse('2026-10-05 10:00:00'));
        $this->quilt->update(['wholesale_price' => 500.00]);
        $action = app(CreateInvoiceAction::class);
        $invoice = $action->execute([
            'sale_type' => SaleType::WHOLESALE->value,
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 1,
                    'unit_price' => 500.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 200.00,
                ],
            ],
        ], $this->cashier);

        Carbon::setTestNow();

        // 3. Print invoice: the transaction with lower ID must NOT be included because its date is after the invoice
        $res = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        $res->assertOk()
            ->assertJsonPath('data.customer.prior_balance', '0.00')
            ->assertJsonPath('data.customer.resulting_balance', '300.00');
    }

    public function test_same_timestamp_transactions_use_id_as_deterministic_tiebreaker(): void
    {
        $frozenTime = Carbon::parse('2026-10-05 12:00:00');
        Carbon::setTestNow($frozenTime);

        // Transaction A created BEFORE the invoice, at the exact same timestamp
        $txBefore = CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => 250.00,
            'description' => 'معاملة مفروشات بنفس التوقيت ورقم تعريف أسبق',
            'created_by' => $this->owner->id,
            'created_at' => $frozenTime,
            'updated_at' => $frozenTime,
        ]);

        // Invoice created at the exact same timestamp
        $this->quilt->update(['wholesale_price' => 300.00]);
        $action = app(CreateInvoiceAction::class);
        $invoice = $action->execute([
            'sale_type' => SaleType::WHOLESALE->value,
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 1,
                    'unit_price' => 300.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 100.00,
                ],
            ],
        ], $this->cashier);

        // Transaction B created AFTER the invoice, at the exact same timestamp
        $txAfter = CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::PAYMENT,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => 50.00,
            'description' => 'معاملة مفروشات بنفس التوقيت ورقم تعريف لاحق',
            'created_by' => $this->cashier->id,
            'created_at' => $frozenTime,
            'updated_at' => $frozenTime,
        ]);

        Carbon::setTestNow();

        $firstInvoiceTxId = CustomerTransaction::where('reference_type', Invoice::class)
            ->where('reference_id', $invoice->id)
            ->min('id');
        $lastInvoiceTxId = CustomerTransaction::where('reference_type', Invoice::class)
            ->where('reference_id', $invoice->id)
            ->max('id');

        $this->assertLessThan($firstInvoiceTxId, $txBefore->id);
        $this->assertGreaterThan($lastInvoiceTxId, $txAfter->id);

        $res = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        // Prior balance must include txBefore (250.00) but exclude txAfter (50.00)
        // Resulting balance = 250 + (300 - 100) = 450.00
        $res->assertOk()
            ->assertJsonPath('data.customer.prior_balance', '250.00')
            ->assertJsonPath('data.customer.resulting_balance', '450.00');
    }

    public function test_walk_in_invoice_without_customer_has_no_balance_section_and_no_errors(): void
    {
        $action = app(CreateInvoiceAction::class);
        $invoice = $action->execute([
            'sale_type' => SaleType::RETAIL->value,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 1,
                    'unit_price' => 900.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 900.00,
                ],
            ],
        ], $this->cashier);

        $this->assertNull($invoice->customer_id);

        $res = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        $res->assertOk()
            ->assertJsonPath('data.customer', null)
            ->assertJsonPath('data.total', '900.00')
            ->assertJsonPath('data.paid_amount', '900.00')
            ->assertJsonPath('data.remaining_amount', '0.00');
    }

    public function test_fully_paid_wholesale_invoice_and_invoice_with_zero_customer_transactions(): void
    {
        // 1. Initial debt of 500
        CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => 500.00,
            'description' => 'رصيد سابق توريد أطقم لحاف',
            'created_by' => $this->owner->id,
        ]);

        // Fully paid wholesale invoice: total 400, paid 400
        $this->quilt->update(['wholesale_price' => 400.00]);
        $action = app(CreateInvoiceAction::class);
        $fullyPaidInvoice = $action->execute([
            'sale_type' => SaleType::WHOLESALE->value,
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 1,
                    'unit_price' => 400.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 400.00,
                ],
            ],
        ], $this->cashier);

        $resFullyPaid = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $fullyPaidInvoice));

        // Resulting balance remains 500.00 because invoice was fully paid at creation
        $resFullyPaid->assertOk()
            ->assertJsonPath('data.customer.prior_balance', '500.00')
            ->assertJsonPath('data.total', '400.00')
            ->assertJsonPath('data.paid_amount', '400.00')
            ->assertJsonPath('data.remaining_amount', '0.00')
            ->assertJsonPath('data.customer.resulting_balance', '500.00');

        // 2. New customer with zero CustomerTransaction rows in the database
        $newCustomer = Customer::factory()->create([
            'name' => 'معرض السعادة للمفروشات',
            'phone' => '01099887766',
            'address' => 'المحلة الكبرى - شارع مفروشات',
            'is_active' => true,
        ]);

        $retailWithCustomerInvoice = $action->execute([
            'sale_type' => SaleType::RETAIL->value,
            'customer_id' => $newCustomer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 1,
                    'unit_price' => 900.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 900.00,
                ],
            ],
        ], $this->cashier);

        // Retail sale does not generate customer transactions; customer has zero transactions
        $this->assertEquals(0, CustomerTransaction::where('customer_id', $newCustomer->id)->count());

        $resZeroTx = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $retailWithCustomerInvoice));

        $resZeroTx->assertOk()
            ->assertJsonPath('data.customer.prior_balance', '0.00')
            ->assertJsonPath('data.customer.resulting_balance', '0.00');
    }

    public function test_reprinting_same_invoice_twice_returns_identical_balance_numbers(): void
    {
        CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => 600.00,
            'description' => 'رصيد سابق توريد بطاطين ومفروشات',
            'created_by' => $this->owner->id,
        ]);

        $this->quilt->update(['wholesale_price' => 350.00]);
        $action = app(CreateInvoiceAction::class);
        $invoice = $action->execute([
            'sale_type' => SaleType::WHOLESALE->value,
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 2,
                    'unit_price' => 350.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 200.00,
                ],
            ],
        ], $this->cashier);

        // First print request
        $res1 = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        // Second print request
        $res2 = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        $res1->assertOk();
        $res2->assertOk();

        $this->assertEquals($res1->json('data.customer.prior_balance'), $res2->json('data.customer.prior_balance'));
        $this->assertEquals($res1->json('data.customer.resulting_balance'), $res2->json('data.customer.resulting_balance'));
        $this->assertEquals($res1->json('data.total'), $res2->json('data.total'));
        $this->assertEquals($res1->json('data.paid_amount'), $res2->json('data.paid_amount'));
        $this->assertEquals('600.00', $res1->json('data.customer.prior_balance'));
        $this->assertEquals('1100.00', $res1->json('data.customer.resulting_balance'));
    }

    public function test_customer_returns_before_vs_after_invoice_are_properly_sequenced(): void
    {
        // 1. Initial debt of 1000 at 2026-10-01
        $initialTx = CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => 1000.00,
            'description' => 'فاتورة مفروشات سابقة',
            'created_by' => $this->owner->id,
        ]);
        $initialTx->forceFill([
            'created_at' => Carbon::parse('2026-10-01 10:00:00'),
            'updated_at' => Carbon::parse('2026-10-01 10:00:00'),
        ])->save();

        // 2. Return prior to invoice at 2026-10-02 (credit 200)
        $returnPrior = CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::RETURN,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => 200.00,
            'description' => 'مرتجع طقم ملايات سابق للفاتورة',
            'created_by' => $this->owner->id,
        ]);
        $returnPrior->forceFill([
            'created_at' => Carbon::parse('2026-10-02 10:00:00'),
            'updated_at' => Carbon::parse('2026-10-02 10:00:00'),
        ])->save();

        // 3. Invoice posted at 2026-10-05: total 500, paid 100
        Carbon::setTestNow(Carbon::parse('2026-10-05 10:00:00'));
        $this->quilt->update(['wholesale_price' => 500.00]);
        $action = app(CreateInvoiceAction::class);
        $invoice = $action->execute([
            'sale_type' => SaleType::WHOLESALE->value,
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 1,
                    'unit_price' => 500.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 100.00,
                ],
            ],
        ], $this->cashier);

        // 4. Return subsequent to invoice at 2026-10-08 (credit 150)
        $returnSubsequent = CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::RETURN,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => 150.00,
            'description' => 'مرتجع بطانية لاحق للفاتورة',
            'created_by' => $this->owner->id,
        ]);
        $returnSubsequent->forceFill([
            'created_at' => Carbon::parse('2026-10-08 10:00:00'),
            'updated_at' => Carbon::parse('2026-10-08 10:00:00'),
        ])->save();

        Carbon::setTestNow();

        // 5. Print invoice: prior balance must be 1000 - 200 = 800.00 (subsequent return excluded)
        // Resulting balance must be 800 + (500 - 100) = 1200.00
        $res = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));

        $res->assertOk()
            ->assertJsonPath('data.customer.prior_balance', '800.00')
            ->assertJsonPath('data.customer.resulting_balance', '1200.00');
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson(route('api.v1.invoices.print', 1))->assertUnauthorized();
    }
}
