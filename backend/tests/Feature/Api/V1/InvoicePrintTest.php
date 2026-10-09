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
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\User;
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

        // Test with Owner user
        $ownerRes = $this->actingAs($this->owner, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));
        $ownerRes->assertOk();
        $this->assertArrayNotHasKey('total_profit', $ownerRes->json('data'));
        $this->assertArrayNotHasKey('profit', $ownerRes->json('data.items.0'));
        $this->assertArrayNotHasKey('unit_cost', $ownerRes->json('data.items.0'));

        // Test with Cashier user
        $cashierRes = $this->actingAs($this->cashier, 'sanctum')
            ->getJson(route('api.v1.invoices.print', $invoice));
        $cashierRes->assertOk();
        $this->assertArrayNotHasKey('total_profit', $cashierRes->json('data'));
        $this->assertArrayNotHasKey('profit', $cashierRes->json('data.items.0'));
        $this->assertArrayNotHasKey('unit_cost', $cashierRes->json('data.items.0'));
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

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson(route('api.v1.invoices.print', 1))->assertUnauthorized();
    }
}
