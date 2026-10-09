<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Auth\Enums\UserRole;
use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Customers\Enums\CustomerTransactionType;
use App\Domain\Payments\Enums\PaymentType;
use App\Domain\Returns\Enums\SalesReturnResolution;
use App\Domain\Sales\Enums\InvoiceItemType;
use App\Domain\Sales\Enums\InvoiceStatus;
use App\Domain\Suppliers\Enums\SupplierTransactionDirection;
use App\Domain\Suppliers\Enums\SupplierTransactionType;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerTransaction;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\Supplier;
use App\Models\SupplierTransaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;

    protected User $cashier;

    protected Category $category;

    protected Product $product;

    protected Customer $customer;

    protected Supplier $supplier;

    protected PaymentMethod $cashMethod;

    protected ExpenseCategory $overheadCategory;

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

        $this->category = Category::factory()->create([
            'name' => 'لحاف ومفروشات',
            'code' => 'K',
        ]);

        $this->product = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'طقم لحاف فاخر',
            'purchase_cost' => '500.00',
            'retail_price' => '800.00',
            'wholesale_price' => '700.00',
            'stock_quantity' => 20,
            'is_active' => true,
        ]);

        $this->customer = Customer::factory()->create([
            'name' => 'معرض الأمل',
            'phone' => '01012345678',
        ]);

        $this->supplier = Supplier::factory()->create([
            'name' => 'مصنع المحلة للغزل',
            'phone' => '01212345678',
        ]);

        $this->cashMethod = PaymentMethod::firstOrCreate(
            ['code' => 'cash'],
            [
                'name' => 'نقدي',
                'is_cash' => true,
                'is_active' => true,
            ]
        );

        $this->overheadCategory = ExpenseCategory::firstOrCreate(
            ['name' => 'إيجار وكهرباء'],
            ['description' => 'مصاريف تشغيل المعرض']
        );
    }

    public function test_unauthenticated_requests_are_denied_with_401(): void
    {
        $endpoints = [
            '/api/v1/reports/overview',
            '/api/v1/reports/sales',
            '/api/v1/reports/profit',
            '/api/v1/reports/expenses',
            '/api/v1/reports/customers',
            '/api/v1/reports/customer-balances',
            '/api/v1/reports/suppliers',
            '/api/v1/reports/supplier-payables',
            '/api/v1/reports/inventory',
            '/api/v1/reports/inventory-valuation',
            '/api/v1/reports/payments',
            '/api/v1/reports/payment-movements',
            '/api/v1/reports/documents',
            '/api/v1/reports/history/invoices',
            '/api/v1/reports/history/returns',
        ];

        foreach ($endpoints as $endpoint) {
            $response = $this->getJson($endpoint);
            $response->assertStatus(401);
        }
    }

    public function test_cashier_requests_are_denied_with_403_on_all_report_endpoints(): void
    {
        $endpoints = [
            '/api/v1/reports/overview',
            '/api/v1/reports/sales',
            '/api/v1/reports/profit',
            '/api/v1/reports/expenses',
            '/api/v1/reports/customers',
            '/api/v1/reports/customer-balances',
            '/api/v1/reports/suppliers',
            '/api/v1/reports/supplier-payables',
            '/api/v1/reports/inventory',
            '/api/v1/reports/inventory-valuation',
            '/api/v1/reports/payments',
            '/api/v1/reports/payment-movements',
            '/api/v1/reports/documents',
            '/api/v1/reports/history/invoices',
            '/api/v1/reports/history/returns',
        ];

        foreach ($endpoints as $endpoint) {
            $response = $this->actingAs($this->cashier, 'sanctum')->getJson($endpoint);
            $response->assertStatus(403);
        }
    }

    public function test_owner_can_access_all_report_endpoints(): void
    {
        $endpoints = [
            '/api/v1/reports/overview',
            '/api/v1/reports/sales',
            '/api/v1/reports/profit',
            '/api/v1/reports/expenses',
            '/api/v1/reports/customers',
            '/api/v1/reports/customer-balances',
            '/api/v1/reports/suppliers',
            '/api/v1/reports/supplier-payables',
            '/api/v1/reports/inventory',
            '/api/v1/reports/inventory-valuation',
            '/api/v1/reports/payments',
            '/api/v1/reports/payment-movements',
            '/api/v1/reports/documents',
            '/api/v1/reports/history/invoices',
            '/api/v1/reports/history/returns',
        ];

        foreach ($endpoints as $endpoint) {
            $response = $this->actingAs($this->owner, 'sanctum')->getJson($endpoint);
            $response->assertStatus(200);
        }
    }

    public function test_empty_datasets_return_valid_zero_results(): void
    {
        // Clear product stock to verify empty inventory valuation
        $this->product->update(['stock_quantity' => 0]);

        $response = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/overview?range_preset=today');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'gross_sales' => '0.00',
                    'net_sales' => '0.00',
                    'invoices_count' => 0,
                    'total_expenses' => '0.00',
                    'total_customer_debts' => '0.00',
                    'total_supplier_payables' => '0.00',
                    'total_inventory_valuation' => '0.00',
                    'total_stock_units' => 0,
                ],
            ]);
    }

    public function test_sales_and_realized_profit_calculation_with_cancellation_and_returns(): void
    {
        // 1. Posted invoice: 2 items @ 800 (unit cost 500) => subtotal 1600, cost 1000, profit 600
        $invoice1 = Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::POSTED,
            'subtotal' => '1600.00',
            'total' => '1600.00',
            'paid_amount' => '1600.00',
            'remaining_amount' => '0.00',
            'credit_amount' => '0.00',
            'created_at' => Carbon::now('Africa/Cairo')->toDateTimeString(),
        ]);

        $item1 = InvoiceItem::factory()->create([
            'invoice_id' => $invoice1->id,
            'product_id' => $this->product->id,
            'item_type' => InvoiceItemType::PRODUCT,
            'product_name' => $this->product->name,
            'quantity' => 2,
            'unit_sale_price' => '800.00',
            'unit_cost' => '500.00',
            'subtotal' => '1600.00',
            'total_cost' => '1000.00',
            'profit' => '600.00',
        ]);

        // 2. Cancelled invoice: must NOT be counted in sales or profit
        $cancelledInvoice = Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::CANCELLED,
            'subtotal' => '2400.00',
            'total' => '2400.00',
            'paid_amount' => '0.00',
            'remaining_amount' => '2400.00',
            'credit_amount' => '0.00',
            'created_at' => Carbon::now('Africa/Cairo')->toDateTimeString(),
        ]);

        InvoiceItem::factory()->create([
            'invoice_id' => $cancelledInvoice->id,
            'product_id' => $this->product->id,
            'item_type' => InvoiceItemType::PRODUCT,
            'quantity' => 3,
            'unit_sale_price' => '800.00',
            'unit_cost' => '500.00',
            'subtotal' => '2400.00',
            'total_cost' => '1500.00',
            'profit' => '900.00',
        ]);

        // 3. Return 1 item from invoice1: refund 800, cost reversal 500, profit reversal 300
        $return = SalesReturn::create([
            'return_number' => 'RET-20261009-0001',
            'invoice_id' => $invoice1->id,
            'customer_id' => null,
            'resolution' => SalesReturnResolution::REFUND_CASH,
            'total_return_amount' => Money::from(800),
            'difference_amount' => Money::zero(),
            'notes' => 'مرتجع نقدي',
            'created_by' => $this->owner->id,
        ]);

        SalesReturnItem::create([
            'sales_return_id' => $return->id,
            'invoice_item_id' => $item1->id,
            'product_id' => $this->product->id,
            'quantity' => Quantity::from(1),
            'unit_sale_price' => Money::from(800),
            'unit_cost' => Money::from(500),
            'subtotal' => Money::from(800),
            'profit_reversal' => Money::from(300),
        ]);

        // Change current product purchase cost to 650.00 to prove historical cost snapshot is preserved!
        $this->product->update(['purchase_cost' => '650.00']);

        // Check sales report endpoint
        $response = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/sales?range_preset=today');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'sales_summary' => [
                        'gross_sales' => '1600.00',
                        'total_returns' => '800.00',
                        'net_sales' => '800.00',
                        'invoices_count' => 1,
                        'returns_count' => 1,
                    ],
                    'profit_analysis' => [
                        'gross_cogs' => '1000.00',
                        'returned_cogs_reversal' => '500.00',
                        'net_cogs' => '500.00',
                        'net_profit' => '300.00',
                    ],
                ],
            ]);
    }

    public function test_policy_c_external_product_expenses_and_no_double_counting(): void
    {
        // Invoice with 1 normal product and 1 external product
        $invoice = Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::POSTED,
            'subtotal' => '1200.00',
            'total' => '1200.00',
            'paid_amount' => '1200.00',
            'remaining_amount' => '0.00',
            'credit_amount' => '0.00',
            'created_at' => Carbon::now('Africa/Cairo')->toDateTimeString(),
        ]);

        // Normal product: sale 800, cost 500, profit 300
        InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'product_id' => $this->product->id,
            'item_type' => InvoiceItemType::PRODUCT,
            'product_name' => $this->product->name,
            'quantity' => 1,
            'unit_sale_price' => '800.00',
            'unit_cost' => '500.00',
            'subtotal' => '800.00',
            'total_cost' => '500.00',
            'profit' => '300.00',
        ]);

        // External product: sale 400, cost 300, profit 100
        $externalItem = InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'product_id' => null,
            'item_type' => InvoiceItemType::EXTERNAL,
            'product_name' => 'بطانية مورا تفصيل خاص',
            'quantity' => 1,
            'unit_sale_price' => '400.00',
            'unit_cost' => '300.00',
            'subtotal' => '400.00',
            'total_cost' => '300.00',
            'profit' => '100.00',
        ]);

        // Linked external product purchase expense
        $extCat = ExpenseCategory::firstOrCreate(
            ['code' => 'external_product'],
            ['name' => 'تكلفة بضاعة خارجية']
        );

        Expense::create([
            'expense_category_id' => $extCat->id,
            'payment_method_id' => $this->cashMethod->id,
            'amount' => Money::from(300),
            'reference_type' => InvoiceItem::class,
            'reference_id' => $externalItem->id,
            'description' => 'شراء خارجي لمنتج بطانية مورا',
            'expense_date' => Carbon::now('Africa/Cairo')->toDateString(),
            'created_by' => $this->owner->id,
        ]);

        // General showroom overhead expense (rent/electricity)
        Expense::create([
            'expense_category_id' => $this->overheadCategory->id,
            'payment_method_id' => $this->cashMethod->id,
            'amount' => Money::from(150),
            'description' => 'فاتورة كهرباء المعرض',
            'expense_date' => Carbon::now('Africa/Cairo')->toDateString(),
            'created_by' => $this->owner->id,
        ]);

        // Under Policy C: Customer returns external item, but external expense remains documented!
        $return = SalesReturn::create([
            'return_number' => 'RET-20261009-0002',
            'invoice_id' => $invoice->id,
            'customer_id' => null,
            'resolution' => SalesReturnResolution::REFUND_CASH,
            'total_return_amount' => Money::from(400),
            'difference_amount' => Money::zero(),
            'notes' => 'مرتجع خارجي',
            'created_by' => $this->owner->id,
        ]);

        SalesReturnItem::create([
            'sales_return_id' => $return->id,
            'invoice_item_id' => $externalItem->id,
            'product_id' => null,
            'quantity' => Quantity::from(1),
            'unit_sale_price' => Money::from(400),
            'unit_cost' => Money::from(300),
            'subtotal' => Money::from(400),
            'profit_reversal' => Money::from(100),
        ]);

        // Test expenses report
        $expResponse = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/expenses?period=today');
        $expResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_expenses' => '450.00',
                    'general_expenses' => '150.00',
                    'external_product_expenses' => '300.00',
                    'expenses_count' => 2,
                ],
            ]);

        // Test overview report to prove Net Operating Result correctly recognizes unrecovered external cost
        $overviewResponse = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/overview?range_preset=today');
        $overviewResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'gross_sales' => '1200.00',
                    'total_returns' => '400.00',
                    'net_sales' => '800.00',
                    'net_realized_gross_profit' => '0.00',
                    'total_expenses' => '450.00',
                    'general_expenses' => '150.00',
                    'external_product_expenses' => '300.00',
                    'net_operating_result' => '-150.00',
                ],
            ]);
    }

    public function test_customer_balances_are_authoritatively_derived_from_ledger(): void
    {
        // Customer 1: Net debit balance of 3000 (debtor)
        CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => Money::from(10000),
            'description' => 'فاتورة بيع جملة رقم INV-001',
            'created_by' => $this->owner->id,
        ]);

        CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::PAYMENT,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => Money::from(7000),
            'description' => 'سداد نقدي من العميل',
            'created_by' => $this->owner->id,
        ]);

        // Customer 2: Net credit balance of 500 (creditor / advance balance)
        $customer2 = Customer::factory()->create([
            'name' => 'معرض السعادة',
            'phone' => '01122334455',
        ]);

        CustomerTransaction::create([
            'customer_id' => $customer2->id,
            'type' => CustomerTransactionType::PAYMENT,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => Money::from(500),
            'description' => 'دفعة تحويل بنكي إضافية',
            'created_by' => $this->owner->id,
        ]);

        $response = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/customers');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_receivable_debts' => '3000.00',
                    'total_customer_credits' => '500.00',
                    'net_ledger_balance' => '2500.00',
                    'debtors_count' => 1,
                    'creditors_count' => 1,
                ],
            ]);
    }

    public function test_supplier_payables_are_authoritatively_derived_from_ledger(): void
    {
        // Supplier transaction: credit 50,000 (we owe them), debit 20,000 (payment) => balance 30,000
        SupplierTransaction::create([
            'supplier_id' => $this->supplier->id,
            'type' => SupplierTransactionType::MANUAL_BALANCE_INCREASE,
            'direction' => SupplierTransactionDirection::CREDIT,
            'amount' => Money::from(50000),
            'description' => 'فاتورة شراء 20 قطعة لحاف وأنتريه',
            'created_by' => $this->owner->id,
        ]);

        SupplierTransaction::create([
            'supplier_id' => $this->supplier->id,
            'type' => SupplierTransactionType::PAYMENT,
            'direction' => SupplierTransactionDirection::DEBIT,
            'amount' => Money::from(20000),
            'description' => 'سداد نقدي للمورد',
            'created_by' => $this->owner->id,
        ]);

        $response = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/suppliers');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_payables_owed' => '30000.00',
                    'with_payable_count' => 1,
                ],
            ]);
    }

    public function test_inventory_valuation_uses_current_stock_and_current_purchase_cost(): void
    {
        // Product 1: stock 20 @ cost 500.00 = 10,000.00
        // Product 2: stock 10 @ cost 300.00 = 3,000.00
        Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'بطانية شتوي مزدوجة',
            'purchase_cost' => '300.00',
            'retail_price' => '450.00',
            'wholesale_price' => '400.00',
            'stock_quantity' => 10,
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/inventory');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_products_count' => 2,
                    'total_units_in_stock' => 30,
                    'total_cost_valuation' => '13000.00',
                ],
            ]);
    }

    public function test_payment_breakdown_and_cash_flow_summary(): void
    {
        $invoice = Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::POSTED,
            'subtotal' => '2000.00',
            'total' => '2000.00',
            'paid_amount' => '2000.00',
            'created_at' => Carbon::now('Africa/Cairo')->toDateTimeString(),
        ]);

        // Customer payment receipt: +2000 cash
        Payment::create([
            'payment_number' => 'PAY-20261009-0001',
            'payment_method_id' => $this->cashMethod->id,
            'payable_type' => Invoice::class,
            'payable_id' => $invoice->id,
            'payment_type' => PaymentType::INVOICE_PAYMENT,
            'amount' => Money::from(2000),
            'paid_at' => Carbon::now('Africa/Cairo'),
            'created_by' => $this->owner->id,
        ]);

        // Cash sales return refund: -500 cash
        Payment::create([
            'payment_number' => 'PAY-20261009-0002',
            'payment_method_id' => $this->cashMethod->id,
            'payable_type' => SalesReturn::class,
            'payable_id' => 1,
            'payment_type' => PaymentType::REFUND,
            'amount' => Money::from(500),
            'paid_at' => Carbon::now('Africa/Cairo'),
            'created_by' => $this->owner->id,
        ]);

        // Cash expense: -200 cash
        Expense::create([
            'expense_category_id' => $this->overheadCategory->id,
            'payment_method_id' => $this->cashMethod->id,
            'amount' => Money::from(200),
            'description' => 'ضيافة المعرض',
            'expense_date' => Carbon::now('Africa/Cairo')->toDateString(),
            'created_by' => $this->owner->id,
        ]);

        $response = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/payments?range_preset=today');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_inflows' => '2000.00',
                    'total_outflows' => '500.00',
                    'net_movement' => '1500.00',
                    'cash_inflows' => '2000.00',
                    'cash_outflows' => '500.00',
                    'net_cash_movement' => '1500.00',
                ],
            ]);
    }

    public function test_date_filters_boundary_behavior_in_cairo_timezone(): void
    {
        $todayCairo = Carbon::now('Africa/Cairo')->toDateString();
        $yesterdayCairo = Carbon::now('Africa/Cairo')->subDays(2)->toDateString();

        // Invoice created yesterday: should NOT be included in today's report
        Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::POSTED,
            'subtotal' => '1000.00',
            'total' => '1000.00',
            'paid_amount' => '1000.00',
            'created_at' => Carbon::now('Africa/Cairo')->subDays(2)->toDateTimeString(),
        ]);

        // Invoice created today: should be included in today's report
        Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::POSTED,
            'subtotal' => '500.00',
            'total' => '500.00',
            'paid_amount' => '500.00',
            'created_at' => Carbon::now('Africa/Cairo')->toDateTimeString(),
        ]);

        $response = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/sales?range_preset=today');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'sales_summary' => [
                        'gross_sales' => '500.00',
                        'invoices_count' => 1,
                    ],
                ],
            ]);

        // Custom range covering both
        $customResponse = $this->actingAs($this->owner, 'sanctum')->getJson("/api/v1/reports/sales?start_date={$yesterdayCairo}&end_date={$todayCairo}");
        $customResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'sales_summary' => [
                        'gross_sales' => '1500.00',
                        'invoices_count' => 2,
                    ],
                ],
            ]);
    }

    public function test_dedicated_profit_endpoint_and_reconciliation(): void
    {
        // 1. Create sale: 2 items @ 800 (unit cost 500) = 1600 revenue, 1000 cost, 600 profit
        $invoice = Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::POSTED,
            'subtotal' => '1600.00',
            'total' => '1600.00',
            'paid_amount' => '1600.00',
            'created_at' => Carbon::now('Africa/Cairo')->toDateTimeString(),
        ]);

        $item = InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'product_id' => $this->product->id,
            'quantity' => 2,
            'unit_sale_price' => '800.00',
            'unit_cost' => '500.00',
            'subtotal' => '1600.00',
            'total_cost' => '1000.00',
            'profit' => '600.00',
        ]);

        // General operating expense (e.g. rent) 100
        Expense::create([
            'expense_category_id' => $this->overheadCategory->id,
            'payment_method_id' => $this->cashMethod->id,
            'amount' => Money::from(100),
            'description' => 'إيجار المعرض',
            'expense_date' => Carbon::now('Africa/Cairo')->toDateString(),
            'created_by' => $this->owner->id,
        ]);

        // Call dedicated profit endpoint
        $response = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/profit?period=today');
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'gross_revenue' => '1600.00',
                    'gross_cogs' => '1000.00',
                    'gross_profit' => '600.00',
                    'returned_revenue' => '0.00',
                    'returned_cogs_reversal' => '0.00',
                    'profit_reversal' => '0.00',
                    'net_revenue' => '1600.00',
                    'net_cogs' => '1000.00',
                    'net_realized_gross_profit' => '600.00',
                    'general_expenses' => '100.00',
                    'net_operating_result' => '500.00', // 600 - 100
                ],
            ]);
        $this->assertArrayHasKey('policy_c_notice', $response->json('data'));
        $this->assertArrayHasKey('formula', $response->json('data'));
    }

    public function test_customer_balances_search_and_pagination(): void
    {
        // Customer 1: Debtor 1,000
        CustomerTransaction::create([
            'customer_id' => $this->customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => Money::from(1000),
            'description' => 'فاتورة بيع',
            'created_by' => $this->owner->id,
        ]);

        // Customer 2: Creditor 200
        $c2 = Customer::factory()->create(['name' => 'معرض السلام', 'phone' => '01599887766']);
        CustomerTransaction::create([
            'customer_id' => $c2->id,
            'type' => CustomerTransactionType::PAYMENT,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => Money::from(200),
            'description' => 'دفعة مقدمة',
            'created_by' => $this->owner->id,
        ]);

        // 1. Search by name
        $searchRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/customer-balances?search=السلام');
        $searchRes->assertStatus(200);
        $this->assertCount(1, $searchRes->json('data.customers'));
        $this->assertEquals($c2->name, $searchRes->json('data.customers.0.name'));

        // 2. Pagination
        $pageRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/customers?per_page=1&page=1');
        $pageRes->assertStatus(200);
        $this->assertCount(1, $pageRes->json('data.customers'));
        $this->assertEquals(1, $pageRes->json('data.pagination.current_page'));
        $this->assertEquals(2, $pageRes->json('data.pagination.total'));
    }

    public function test_supplier_payables_search_and_pagination(): void
    {
        // Supplier 1: Payable 5,000
        SupplierTransaction::create([
            'supplier_id' => $this->supplier->id,
            'type' => SupplierTransactionType::MANUAL_BALANCE_INCREASE,
            'direction' => SupplierTransactionDirection::CREDIT,
            'amount' => Money::from(5000),
            'description' => 'مستحق للمورد',
            'created_by' => $this->owner->id,
        ]);

        // Supplier 2: Settled 0
        $s2 = Supplier::factory()->create(['name' => 'مصنع النور', 'phone' => '01199998888']);

        // Search by name
        $searchRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/supplier-payables?search=المحلة');
        $searchRes->assertStatus(200);
        $this->assertCount(1, $searchRes->json('data.suppliers'));
        $this->assertEquals($this->supplier->name, $searchRes->json('data.suppliers.0.name'));

        // Pagination
        $pageRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/suppliers?per_page=1&page=1');
        $pageRes->assertStatus(200);
        $this->assertCount(1, $pageRes->json('data.suppliers'));
        $this->assertEquals(2, $pageRes->json('data.pagination.total'));
    }

    public function test_inventory_valuation_with_inactive_products_and_search(): void
    {
        // Inactive product: 5 items @ 200 = 1,000 cost valuation
        Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'مفرش تركي مطرز قديم',
            'barcode' => 'K9999',
            'purchase_cost' => '200.00',
            'retail_price' => '350.00',
            'wholesale_price' => '300.00',
            'stock_quantity' => 5,
            'is_active' => false,
        ]);

        // 1. Both active and inactive queried under status=all
        $allRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/inventory-valuation?status=all');
        $allRes->assertStatus(200);
        $this->assertEquals(2, $allRes->json('data.total_products_count'));
        $this->assertArrayHasKey('categories', $allRes->json('data'));
        $this->assertArrayHasKey('categories_breakdown', $allRes->json('data'));

        // 2. Active only
        $activeRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/inventory?status=active');
        $activeRes->assertStatus(200);
        $this->assertEquals(1, $activeRes->json('data.total_products_count'));

        // 3. Search by barcode
        $searchRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/inventory?search=K9999');
        $searchRes->assertStatus(200);
        $this->assertCount(1, $searchRes->json('data.products'));
        $this->assertEquals('K9999', $searchRes->json('data.products.0.barcode'));
    }

    public function test_payment_movements_inflows_and_refunds_distinction(): void
    {
        $response = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/payment-movements?period=today');
        $response->assertStatus(200);
        $this->assertArrayHasKey('payment_methods', $response->json('data'));
        $this->assertArrayHasKey('methods_breakdown', $response->json('data'));
        $this->assertArrayHasKey('scope_notice', $response->json('data'));
    }

    public function test_documents_unified_endpoint_for_invoices_and_returns(): void
    {
        // 1. Invoices documents
        $invDocRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/documents?type=invoices');
        $invDocRes->assertStatus(200);
        $this->assertArrayHasKey('items', $invDocRes->json('data'));

        // 2. Returns documents
        $retDocRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/documents?type=returns');
        $retDocRes->assertStatus(200);
        $this->assertArrayHasKey('items', $retDocRes->json('data'));
    }

    public function test_date_filters_validation_errors(): void
    {
        // Invalid period preset
        $res = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/sales?period=invalid_period');
        $res->assertStatus(422)
            ->assertJsonValidationErrors(['period']);

        // End date before start date
        $res2 = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/sales?start_date=2026-10-10&end_date=2026-10-05');
        $res2->assertStatus(422)
            ->assertJsonValidationErrors(['end_date']);
    }

    public function test_cashier_confidentiality_on_invoice_cost_and_profit(): void
    {
        $invoice = Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::POSTED,
            'subtotal' => '800.00',
            'total' => '800.00',
            'paid_amount' => '800.00',
        ]);

        InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'unit_sale_price' => '800.00',
            'unit_cost' => '500.00',
            'subtotal' => '800.00',
            'total_cost' => '500.00',
            'profit' => '300.00',
        ]);

        // Cashier viewing invoice details: cost and profit MUST NOT be present!
        $cashierRes = $this->actingAs($this->cashier, 'sanctum')->getJson("/api/v1/invoices/{$invoice->id}");
        $cashierRes->assertStatus(200);
        $this->assertNull($cashierRes->json('data.total_profit'));
        $this->assertNull($cashierRes->json('data.items.0.unit_cost'));
        $this->assertNull($cashierRes->json('data.items.0.total_cost'));
        $this->assertNull($cashierRes->json('data.items.0.profit'));

        // Owner viewing invoice details: cost and profit ARE present!
        $ownerRes = $this->actingAs($this->owner, 'sanctum')->getJson("/api/v1/invoices/{$invoice->id}");
        $ownerRes->assertStatus(200);
        $this->assertEquals('300.00', $ownerRes->json('data.total_profit'));
        $this->assertEquals('500.00', $ownerRes->json('data.items.0.unit_cost'));
        $this->assertEquals('300.00', $ownerRes->json('data.items.0.profit'));
    }

    /**
     * Concrete scenario required by user:
     * 1. External item purchased for 600.
     * 2. Sold to customer for 900.
     * 3. External purchase expense recorded as 600.
     * 4. Customer returns item and receives refund of 900.
     * 5. External seller does NOT refund the showroom.
     *
     * Expected business outcome: Showroom must report an exact loss of 600 before other expenses!
     */
    public function test_concrete_external_product_return_scenario_produces_exact_loss_of_600(): void
    {
        $today = Carbon::now('Africa/Cairo');

        // 1 & 2. External item sold for 900, purchase cost 600, profit 300
        $invoice = Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::POSTED,
            'subtotal' => '900.00',
            'total' => '900.00',
            'paid_amount' => '900.00',
            'created_at' => $today->toDateTimeString(),
        ]);

        $externalItem = InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'product_id' => null,
            'item_type' => InvoiceItemType::EXTERNAL,
            'product_name' => 'مفرش سرير مطرز تفصيل خاص',
            'quantity' => 1,
            'unit_sale_price' => '900.00',
            'unit_cost' => '600.00',
            'subtotal' => '900.00',
            'total_cost' => '600.00',
            'profit' => '300.00',
        ]);

        // Payment for the sale
        Payment::create([
            'payment_number' => 'PAY-20261009-8801',
            'payment_method_id' => $this->cashMethod->id,
            'amount' => Money::from(900),
            'payment_type' => PaymentType::INVOICE_PAYMENT,
            'payable_type' => Invoice::class,
            'payable_id' => $invoice->id,
            'paid_at' => $today,
            'created_by' => $this->owner->id,
        ]);

        // 3. External purchase expense recorded as 600
        $extCat = ExpenseCategory::firstOrCreate(
            ['code' => 'external_product'],
            ['name' => 'تكلفة بضاعة خارجية']
        );

        Expense::create([
            'expense_category_id' => $extCat->id,
            'payment_method_id' => $this->cashMethod->id,
            'amount' => Money::from(600),
            'reference_type' => InvoiceItem::class,
            'reference_id' => $externalItem->id,
            'description' => 'تكلفة شراء خارجي لمفرش مطرز',
            'expense_date' => $today->toDateString(),
            'created_by' => $this->owner->id,
        ]);

        // 4. Customer returns the item and receives refund of 900
        $return = SalesReturn::create([
            'return_number' => 'RET-20261009-8801',
            'invoice_id' => $invoice->id,
            'customer_id' => null,
            'resolution' => SalesReturnResolution::REFUND_CASH,
            'total_return_amount' => Money::from(900),
            'difference_amount' => Money::zero(),
            'notes' => 'مرتجع منتج خارجي مع استرداد نقدي كامل',
            'created_by' => $this->owner->id,
            'created_at' => $today->toDateTimeString(),
        ]);

        SalesReturnItem::create([
            'sales_return_id' => $return->id,
            'invoice_item_id' => $externalItem->id,
            'product_id' => null,
            'quantity' => Quantity::from(1),
            'unit_sale_price' => Money::from(900),
            'unit_cost' => Money::from(600),
            'subtotal' => Money::from(900),
            'profit_reversal' => Money::from(300),
        ]);

        Payment::create([
            'payment_number' => 'PAY-20261009-8802',
            'payment_method_id' => $this->cashMethod->id,
            'amount' => Money::from(900),
            'payment_type' => PaymentType::REFUND,
            'payable_type' => SalesReturn::class,
            'payable_id' => $return->id,
            'paid_at' => $today,
            'created_by' => $this->owner->id,
        ]);

        // 5. External seller does NOT refund the showroom (Policy C default: expense remains intact)

        // Verify /reports/sales
        $salesRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/sales?range_preset=today');
        $salesRes->assertStatus(200);
        $this->assertEquals('900.00', $salesRes->json('data.sales_summary.gross_sales'));
        $this->assertEquals('900.00', $salesRes->json('data.sales_summary.total_returns'));
        $this->assertEquals('0.00', $salesRes->json('data.sales_summary.net_sales'));
        $this->assertEquals('900.00', $salesRes->json('data.profit_analysis.gross_revenue'));
        $this->assertEquals('900.00', $salesRes->json('data.profit_analysis.returned_revenue'));
        $this->assertEquals('0.00', $salesRes->json('data.profit_analysis.net_revenue'));
        $this->assertEquals('600.00', $salesRes->json('data.profit_analysis.gross_cogs'));
        $this->assertEquals('0.00', $salesRes->json('data.profit_analysis.returned_cogs_reversal'), 'External product COGS must NOT be reversed when vendor did not refund');
        $this->assertEquals('600.00', $salesRes->json('data.profit_analysis.net_cogs'));
        $this->assertEquals('300.00', $salesRes->json('data.profit_analysis.gross_profit'));
        $this->assertEquals('900.00', $salesRes->json('data.profit_analysis.profit_reversal'));
        $this->assertEquals('-600.00', $salesRes->json('data.profit_analysis.net_profit'), 'Net profit MUST reflect the exact commercial loss of 600');

        // Verify dedicated /reports/profit
        $profitRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/profit?range_preset=today');
        $profitRes->assertStatus(200);
        $this->assertEquals('0.00', $profitRes->json('data.net_revenue'));
        $this->assertEquals('600.00', $profitRes->json('data.net_cogs'));
        $this->assertEquals('-600.00', $profitRes->json('data.net_realized_gross_profit'));
        $this->assertEquals('600.00', $profitRes->json('data.total_expenses'));
        $this->assertEquals('0.00', $profitRes->json('data.general_expenses'));
        $this->assertEquals('600.00', $profitRes->json('data.external_product_expenses'));
        $this->assertEquals('-600.00', $profitRes->json('data.net_operating_result'), 'Net operating result MUST report a loss of 600 before other expenses');

        // Verify /reports/overview
        $overviewRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/overview?range_preset=today');
        $overviewRes->assertStatus(200);
        $this->assertEquals('-600.00', $overviewRes->json('data.net_realized_gross_profit'));
        $this->assertEquals('-600.00', $overviewRes->json('data.net_operating_result'));
        $this->assertEquals('900.00', $overviewRes->json('data.total_payment_inflows'));
        $this->assertEquals('900.00', $overviewRes->json('data.total_refund_outflows'));
        $this->assertEquals('0.00', $overviewRes->json('data.net_cash_movement'));
    }

    /**
     * Test normal product return regression and current purchase cost invariance:
     * - Purchase cost: 400
     * - Sale price: 700
     * - Customer receives full refund after returning the item.
     * - Verify COGS reversal, inventory restoration, and realized profit reconciliation.
     * - Confirm that changing current purchase cost later does NOT alter historical report calculations.
     */
    public function test_normal_product_return_regression_and_current_cost_change_invariance(): void
    {
        $today = Carbon::now('Africa/Cairo');

        // Create dedicated normal showroom product: cost 400, retail 700, stock 10
        $normalProduct = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'طقم سرير قطن مصري مطرز',
            'purchase_cost' => '400.00',
            'retail_price' => '700.00',
            'wholesale_price' => '600.00',
            'stock_quantity' => 10,
            'is_active' => true,
        ]);

        // Sale: 1 unit sold for 700
        $invoice = Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::POSTED,
            'subtotal' => '700.00',
            'total' => '700.00',
            'paid_amount' => '700.00',
            'created_at' => $today->toDateTimeString(),
        ]);

        $invoiceItem = InvoiceItem::factory()->create([
            'invoice_id' => $invoice->id,
            'product_id' => $normalProduct->id,
            'item_type' => InvoiceItemType::PRODUCT,
            'product_name' => $normalProduct->name,
            'quantity' => 1,
            'unit_sale_price' => '700.00',
            'unit_cost' => '400.00',
            'subtotal' => '700.00',
            'total_cost' => '400.00',
            'profit' => '300.00',
        ]);

        $normalProduct->update(['stock_quantity' => Quantity::from(9)]);
        $this->assertEquals(9, $normalProduct->fresh()->stock_quantity->toInt());

        // Later, showroom updates current purchase cost of this product to 550.00!
        $normalProduct->update(['purchase_cost' => '550.00']);
        $this->assertEquals('550.00', $normalProduct->fresh()->purchase_cost->toDecimal());

        // Customer returns item and receives full refund of 700
        $return = SalesReturn::create([
            'return_number' => 'RET-20261009-9901',
            'invoice_id' => $invoice->id,
            'customer_id' => null,
            'resolution' => SalesReturnResolution::REFUND_CASH,
            'total_return_amount' => Money::from(700),
            'difference_amount' => Money::zero(),
            'notes' => 'مرتجع قطاعي عادي',
            'created_by' => $this->owner->id,
            'created_at' => $today->toDateTimeString(),
        ]);

        SalesReturnItem::create([
            'sales_return_id' => $return->id,
            'invoice_item_id' => $invoiceItem->id,
            'product_id' => $normalProduct->id,
            'quantity' => Quantity::from(1),
            'unit_sale_price' => Money::from(700),
            'unit_cost' => Money::from(400), // Immutable historical cost snapshot!
            'subtotal' => Money::from(700),
            'profit_reversal' => Money::from(300),
        ]);

        // Stock restored to 10
        $normalProduct->update(['stock_quantity' => Quantity::from(10)]);
        $this->assertEquals(10, $normalProduct->fresh()->stock_quantity->toInt());

        // Verify report calculations:
        // COGS was reversed (item returned to inventory assets), profit reversed, net profit is 0.00
        $profitRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/profit?range_preset=today');
        $profitRes->assertStatus(200);
        $this->assertEquals('700.00', $profitRes->json('data.gross_revenue'));
        $this->assertEquals('700.00', $profitRes->json('data.returned_revenue'));
        $this->assertEquals('0.00', $profitRes->json('data.net_revenue'));
        $this->assertEquals('400.00', $profitRes->json('data.gross_cogs'), 'Historical COGS must use frozen 400.00 snapshot, not 550.00');
        $this->assertEquals('400.00', $profitRes->json('data.returned_cogs_reversal'), 'Normal product COGS must be reversed to inventory asset');
        $this->assertEquals('0.00', $profitRes->json('data.net_cogs'));
        $this->assertEquals('300.00', $profitRes->json('data.gross_profit'));
        $this->assertEquals('300.00', $profitRes->json('data.profit_reversal'));
        $this->assertEquals('0.00', $profitRes->json('data.net_realized_gross_profit'));
        $this->assertEquals('0.00', $profitRes->json('data.net_operating_result'));

        // Inventory valuation uses CURRENT purchase cost (10 units * 550.00 = 5500.00 for this product)
        $invRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/inventory');
        $invRes->assertStatus(200);
        $productRow = collect($invRes->json('data.products'))->firstWhere('id', $normalProduct->id);
        $this->assertNotNull($productRow);
        $this->assertEquals('550.00', $productRow['purchase_cost']);
        $this->assertEquals('5500.00', $productRow['cost_valuation']);
    }

    /**
     * Test comprehensive sales, returns, exchanges, and cancelled invoices reconciliation:
     * - Cancelled invoices are strictly excluded.
     * - Replacement invoices are counted as real sales exactly once.
     * - Returns are deducted exactly once.
     * - Equal exchange and upgrade exchange with difference payment reconcile across period.
     */
    public function test_comprehensive_sales_returns_replacement_and_cancelled_invoices_reconciliation(): void
    {
        $today = Carbon::now('Africa/Cairo');

        // 1. Normal posted sale: 1000
        $postedInvoice = Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::POSTED,
            'subtotal' => '1000.00',
            'total' => '1000.00',
            'paid_amount' => '1000.00',
            'created_at' => $today->toDateTimeString(),
        ]);
        InvoiceItem::factory()->create([
            'invoice_id' => $postedInvoice->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'unit_sale_price' => '1000.00',
            'unit_cost' => '600.00',
            'subtotal' => '1000.00',
            'total_cost' => '600.00',
            'profit' => '400.00',
        ]);

        // 2. Cancelled invoice: 2500 (MUST BE STRICTLY EXCLUDED)
        $cancelledInvoice = Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::CANCELLED,
            'subtotal' => '2500.00',
            'total' => '2500.00',
            'paid_amount' => '0.00',
            'created_at' => $today->toDateTimeString(),
        ]);
        InvoiceItem::factory()->create([
            'invoice_id' => $cancelledInvoice->id,
            'product_id' => $this->product->id,
            'quantity' => 2,
            'unit_sale_price' => '1250.00',
            'unit_cost' => '600.00',
            'subtotal' => '2500.00',
            'total_cost' => '1200.00',
            'profit' => '1300.00',
        ]);

        // 3. Exchange scenario:
        // Original sale was 800. Customer returns it for exchange.
        $origInvoice = Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::POSTED,
            'subtotal' => '800.00',
            'total' => '800.00',
            'paid_amount' => '800.00',
            'created_at' => $today->toDateTimeString(),
        ]);
        $origItem = InvoiceItem::factory()->create([
            'invoice_id' => $origInvoice->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'unit_sale_price' => '800.00',
            'unit_cost' => '500.00',
            'subtotal' => '800.00',
            'total_cost' => '500.00',
            'profit' => '300.00',
        ]);

        // Upgrade exchange: Return 800, Replacement invoice 1000, difference collected 200
        $replacementInvoice = Invoice::factory()->create([
            'sale_type' => 'retail',
            'status' => InvoiceStatus::POSTED,
            'subtotal' => '1000.00',
            'total' => '1000.00',
            'paid_amount' => '1000.00',
            'notes' => 'فاتورة استبدال مرتبطة بمرتجع رقم RET-EX-001',
            'created_at' => $today->toDateTimeString(),
        ]);
        InvoiceItem::factory()->create([
            'invoice_id' => $replacementInvoice->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'unit_sale_price' => '1000.00',
            'unit_cost' => '500.00',
            'subtotal' => '1000.00',
            'total_cost' => '500.00',
            'profit' => '500.00',
        ]);

        $exchangeReturn = SalesReturn::create([
            'return_number' => 'RET-EX-001',
            'invoice_id' => $origInvoice->id,
            'replacement_invoice_id' => $replacementInvoice->id,
            'customer_id' => null,
            'resolution' => SalesReturnResolution::EXCHANGE_UPGRADE,
            'total_return_amount' => Money::from(800),
            'difference_amount' => Money::from(200),
            'notes' => 'استبدال ترقية',
            'created_by' => $this->owner->id,
            'created_at' => $today->toDateTimeString(),
        ]);

        SalesReturnItem::create([
            'sales_return_id' => $exchangeReturn->id,
            'invoice_item_id' => $origItem->id,
            'product_id' => $this->product->id,
            'quantity' => Quantity::from(1),
            'unit_sale_price' => Money::from(800),
            'unit_cost' => Money::from(500),
            'subtotal' => Money::from(800),
            'profit_reversal' => Money::from(300),
        ]);

        // Reconciliation assertions:
        // Gross sales = postedInvoice (1000) + origInvoice (800) + replacementInvoice (1000) = 2800.00
        // (Cancelled invoice 2500 is completely excluded)
        // Total returns = exchangeReturn (800.00)
        // Net sales = 2800 - 800 = 2000.00
        // Replacement sales distinctly tracked = 1000.00
        $salesRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/reports/sales?range_preset=today');
        $salesRes->assertStatus(200);

        $summary = $salesRes->json('data.sales_summary');
        $this->assertEquals('2800.00', $summary['gross_sales']);
        $this->assertEquals('800.00', $summary['total_returns']);
        $this->assertEquals('2000.00', $summary['net_sales']);
        $this->assertEquals('1000.00', $summary['replacement_sales']);
        $this->assertEquals(3, $summary['invoices_count'], 'Must include exactly the 3 posted invoices');

        // Profit reconciliation:
        // Gross Revenue = 2800.00
        // Returned Revenue = 800.00
        // Net Revenue = 2000.00
        // Gross COGS = 600 + 500 + 500 = 1600.00
        // Returned COGS Reversal = 500.00 (origItem returned to stock)
        // Net COGS = 1600 - 500 = 1100.00
        // Gross Profit = 400 + 300 + 500 = 1200.00
        // Profit Reversal = 300.00
        // Net Realized Gross Profit = 1200 - 300 = 900.00
        // Check: Net Revenue (2000) - Net COGS (1100) = 900.00!
        $profit = $salesRes->json('data.profit_analysis');
        $this->assertEquals('2800.00', $profit['gross_revenue']);
        $this->assertEquals('800.00', $profit['returned_revenue']);
        $this->assertEquals('2000.00', $profit['net_revenue']);
        $this->assertEquals('1600.00', $profit['gross_cogs']);
        $this->assertEquals('500.00', $profit['returned_cogs_reversal']);
        $this->assertEquals('1100.00', $profit['net_cogs']);
        $this->assertEquals('1200.00', $profit['gross_profit']);
        $this->assertEquals('300.00', $profit['profit_reversal']);
        $this->assertEquals('900.00', $profit['net_profit']);
    }
}
