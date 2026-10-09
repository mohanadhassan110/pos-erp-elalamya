<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Auth\Enums\UserRole;
use App\Domain\Returns\Enums\SalesReturnResolution;
use App\Domain\Sales\Enums\InvoiceItemType;
use App\Domain\Sales\Enums\InvoiceStatus;
use App\Domain\Sales\Enums\SaleType;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $cashier;

    private User $inactiveUser;

    private Category $category;

    private Product $quilt;

    private Customer $customer;

    private Supplier $supplier;

    private PaymentMethod $cashMethod;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'name' => 'مالك المعرض',
            'username' => 'owner_secure',
            'email' => 'owner_secure@elalamya.com',
            'password' => Hash::make('OwnerSecurePass123'),
            'role' => UserRole::OWNER,
            'is_active' => true,
        ]);

        $this->cashier = User::factory()->create([
            'name' => 'كاشير المعرض',
            'username' => 'cashier_secure',
            'email' => 'cashier_secure@elalamya.com',
            'password' => Hash::make('CashierSecurePass123'),
            'role' => UserRole::CASHIER,
            'is_active' => true,
        ]);

        $this->inactiveUser = User::factory()->create([
            'name' => 'مستخدم معطل',
            'username' => 'inactive_user',
            'email' => 'inactive@elalamya.com',
            'password' => Hash::make('InactivePass123'),
            'role' => UserRole::CASHIER,
            'is_active' => false,
        ]);

        $this->category = Category::create([
            'name' => 'مفروشات منزلية',
            'code' => 'M',
            'is_active' => true,
        ]);

        $this->quilt = Product::create([
            'category_id' => $this->category->id,
            'name' => 'طقم لحاف قطن فاخر 6 قطع',
            'barcode' => 'M0001',
            'purchase_cost' => Money::from(600),
            'wholesale_price' => Money::from(800),
            'retail_price' => Money::from(1000),
            'stock_quantity' => Quantity::from(20),
            'is_active' => true,
        ]);

        $this->customer = Customer::create([
            'name' => 'معرض السعادة للمفروشات',
            'phone' => '01011223344',
            'address' => 'طنطا - شارع المحطة',
            'is_active' => true,
        ]);

        $this->supplier = Supplier::create([
            'name' => 'مصنع النساجون للمفروشات',
            'phone' => '01099887766',
            'address' => 'المحلة الكبرى',
            'is_active' => true,
        ]);

        $this->cashMethod = PaymentMethod::firstOrCreate(
            ['code' => 'cash'],
            ['name' => 'نقدي كاش', 'is_cash' => true, 'is_active' => true]
        );
    }

    /**
     * Requirement: 401 for unauthenticated access across all protected route groups.
     */
    public function test_unauthenticated_requests_receive_401_across_all_route_groups(): void
    {
        $protectedEndpoints = [
            'GET' => [
                '/api/v1/auth/me',
                '/api/v1/categories',
                '/api/v1/products',
                '/api/v1/customers',
                '/api/v1/suppliers',
                '/api/v1/stock-receipts',
                '/api/v1/invoices',
                '/api/v1/returns',
                '/api/v1/inventory',
                '/api/v1/reports/sales',
                '/api/v1/reports/profit',
                '/api/v1/reports/overview',
                '/api/v1/reports/expenses',
                '/api/v1/system/owner-check',
                '/api/v1/system/cashier-check',
            ],
            'POST' => [
                '/api/v1/auth/logout',
                '/api/v1/categories',
                '/api/v1/products',
                '/api/v1/customers',
                '/api/v1/suppliers',
                '/api/v1/stock-receipts',
                '/api/v1/invoices',
                '/api/v1/returns',
                '/api/v1/products/barcodes/print-preview',
            ],
        ];

        foreach ($protectedEndpoints['GET'] as $uri) {
            $response = $this->getJson($uri);
            $response->assertStatus(401)
                ->assertJson([
                    'success' => false,
                    'code' => 'UNAUTHORIZED',
                ]);
        }

        foreach ($protectedEndpoints['POST'] as $uri) {
            $response = $this->postJson($uri, []);
            $response->assertStatus(401)
                ->assertJson([
                    'success' => false,
                    'code' => 'UNAUTHORIZED',
                ]);
        }
    }

    /**
     * Requirement: 403 for each role that must not access a route (Role Matrix Enforcement).
     */
    public function test_cashier_is_strictly_forbidden_from_all_report_and_owner_endpoints(): void
    {
        $ownerOnlyEndpoints = [
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
            '/api/v1/system/owner-check',
        ];

        foreach ($ownerOnlyEndpoints as $uri) {
            $response = $this->actingAs($this->cashier, 'sanctum')->getJson($uri);
            $response->assertStatus(403)
                ->assertJson([
                    'success' => false,
                    'code' => 'FORBIDDEN',
                ]);
        }
    }

    /**
     * Requirement: Inactive user is strictly rejected with 403 on all operational and system endpoints.
     */
    public function test_inactive_user_is_forbidden_even_with_valid_token(): void
    {
        $response = $this->actingAs($this->inactiveUser, 'sanctum')->getJson('/api/v1/invoices');
        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'code' => 'FORBIDDEN',
            ]);
    }

    /**
     * Requirement: Cashier cannot see cost, profit, reports, or expense data anywhere.
     */
    public function test_cashier_cannot_see_cost_or_profit_on_invoices_and_returns(): void
    {
        // 1. Invoice with confidential purchase cost and profit
        $invoice = Invoice::create([
            'invoice_number' => 'INV-20261009-0001',
            'sale_type' => SaleType::RETAIL,
            'status' => InvoiceStatus::POSTED,
            'subtotal' => Money::from(1000),
            'discount_amount' => Money::zero(),
            'total' => Money::from(1000),
            'paid_amount' => Money::from(1000),
            'created_by' => $this->owner->id,
        ]);

        $item = InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'product_id' => $this->quilt->id,
            'item_type' => InvoiceItemType::PRODUCT,
            'product_name' => $this->quilt->name,
            'barcode' => $this->quilt->barcode,
            'quantity' => Quantity::from(1),
            'unit_sale_price' => Money::from(1000),
            'unit_cost' => Money::from(600), // Snapshot
            'subtotal' => Money::from(1000),
            'total_cost' => Money::from(600),
            'profit' => Money::from(400),
        ]);

        // Cashier viewing invoice details
        $cashierInvoiceRes = $this->actingAs($this->cashier, 'sanctum')->getJson("/api/v1/invoices/{$invoice->id}");
        $cashierInvoiceRes->assertOk();
        $this->assertNull($cashierInvoiceRes->json('data.total_profit'));
        $this->assertNull($cashierInvoiceRes->json('data.items.0.unit_cost'));
        $this->assertNull($cashierInvoiceRes->json('data.items.0.total_cost'));
        $this->assertNull($cashierInvoiceRes->json('data.items.0.profit'));

        // Owner viewing invoice details sees internal metrics
        $ownerInvoiceRes = $this->actingAs($this->owner, 'sanctum')->getJson("/api/v1/invoices/{$invoice->id}");
        $ownerInvoiceRes->assertOk();
        $this->assertEquals('400.00', $ownerInvoiceRes->json('data.total_profit'));
        $this->assertEquals('600.00', $ownerInvoiceRes->json('data.items.0.unit_cost'));
        $this->assertEquals('400.00', $ownerInvoiceRes->json('data.items.0.profit'));

        // 2. Sales return with confidential profit reversal
        $salesReturn = SalesReturn::create([
            'return_number' => 'RET-20261009-0001',
            'invoice_id' => $invoice->id,
            'resolution' => SalesReturnResolution::REFUND_CASH,
            'total_return_amount' => Money::from(1000),
            'difference_amount' => Money::zero(),
            'created_by' => $this->owner->id,
        ]);

        SalesReturnItem::create([
            'sales_return_id' => $salesReturn->id,
            'invoice_item_id' => $item->id,
            'product_id' => $this->quilt->id,
            'quantity' => Quantity::from(1),
            'unit_sale_price' => Money::from(1000),
            'unit_cost' => Money::from(600),
            'subtotal' => Money::from(1000),
            'profit_reversal' => Money::from(400),
        ]);

        // Cashier viewing return details
        $cashierReturnRes = $this->actingAs($this->cashier, 'sanctum')->getJson("/api/v1/returns/{$salesReturn->id}");
        $cashierReturnRes->assertOk();
        $this->assertNull($cashierReturnRes->json('data.total_profit_reversed'));
        $this->assertNull($cashierReturnRes->json('data.items.0.unit_cost'));
        $this->assertNull($cashierReturnRes->json('data.items.0.profit_reversal'));

        // Owner viewing return details sees reversed profit
        $ownerReturnRes = $this->actingAs($this->owner, 'sanctum')->getJson("/api/v1/returns/{$salesReturn->id}");
        $ownerReturnRes->assertOk();
        $this->assertEquals('400.00', $ownerReturnRes->json('data.total_profit_reversed'));
        $this->assertEquals('600.00', $ownerReturnRes->json('data.items.0.unit_cost'));
        $this->assertEquals('400.00', $ownerReturnRes->json('data.items.0.profit_reversal'));
    }

    /**
     * Requirement: IDOR protection. Non-existent IDs return 404 cleanly.
     */
    public function test_idor_non_existent_entity_ids_return_404(): void
    {
        $nonExistentIds = [
            '/api/v1/invoices/999999',
            '/api/v1/invoices/999999/print',
            '/api/v1/returns/999999',
            '/api/v1/customers/999999',
            '/api/v1/suppliers/999999',
            '/api/v1/products/999999',
            '/api/v1/categories/999999',
            '/api/v1/stock-receipts/999999',
        ];

        foreach ($nonExistentIds as $uri) {
            $response = $this->actingAs($this->cashier, 'sanctum')->getJson($uri);
            $response->assertStatus(404)
                ->assertJson([
                    'success' => false,
                    'code' => 'NOT_FOUND',
                ]);
        }
    }

    /**
     * Requirement: Mass-assignment attempts on invoices are ignored or rejected.
     */
    public function test_mass_assignment_tampering_on_invoices_is_ignored(): void
    {
        $payload = [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 1,
                    'unit_sale_price' => 1000.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 1000.00,
                ],
            ],
            // Malicious mass-assignment injection attempts:
            'invoice_number' => 'INV-HACKED-0001',
            'status' => 'cancelled',
            'total' => '1.00',
            'paid_amount' => '99999.00',
            'remaining_amount' => '0.00',
            'credit_amount' => '50000.00',
            'created_by' => 9999,
        ];

        $response = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/invoices', $payload);
        $response->assertStatus(201);

        $invoiceId = $response->json('data.id');
        $createdInvoice = Invoice::findOrFail($invoiceId);

        // System must have generated its own sequential invoice number, not the injected one
        $this->assertNotEquals('INV-HACKED-0001', $createdInvoice->invoice_number);
        $this->assertStringStartsWith('INV-', $createdInvoice->invoice_number);

        // Status must be POSTED, not cancelled
        $this->assertEquals(InvoiceStatus::POSTED, $createdInvoice->status);

        // Authoritative totals must match the real calculation (1000.00), not the injected 1.00
        $this->assertEquals('1000.00', $createdInvoice->total->toDecimal());
        $this->assertEquals('1000.00', $createdInvoice->paid_amount->toDecimal());
        $this->assertEquals('0.00', $createdInvoice->credit_amount->toDecimal());

        // Created by must be the authenticated cashier, not 9999
        $this->assertEquals($this->cashier->id, $createdInvoice->created_by);
    }

    /**
     * Requirement: Print and barcode outputs remain free of cost/profit/external markers for both roles.
     */
    public function test_print_and_barcode_outputs_are_strictly_free_of_confidential_markers(): void
    {
        $invoice = Invoice::create([
            'invoice_number' => 'INV-20261009-0002',
            'sale_type' => SaleType::RETAIL,
            'status' => InvoiceStatus::POSTED,
            'subtotal' => Money::from(1000),
            'discount_amount' => Money::zero(),
            'total' => Money::from(1000),
            'paid_amount' => Money::from(1000),
            'created_by' => $this->owner->id,
        ]);

        InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'product_id' => $this->quilt->id,
            'item_type' => InvoiceItemType::PRODUCT,
            'product_name' => $this->quilt->name,
            'barcode' => $this->quilt->barcode,
            'quantity' => Quantity::from(1),
            'unit_sale_price' => Money::from(1000),
            'unit_cost' => Money::from(600),
            'subtotal' => Money::from(1000),
            'total_cost' => Money::from(600),
            'profit' => Money::from(400),
        ]);

        $forbiddenKeys = [
            'purchase_cost',
            'unit_cost',
            'total_cost',
            'profit',
            'expense_id',
            'is_external',
            'item_type',
        ];

        // 1. Invoice Print endpoint for Owner and Cashier
        foreach ([$this->owner, $this->cashier] as $user) {
            $res = $this->actingAs($user, 'sanctum')->getJson("/api/v1/invoices/{$invoice->id}/print");
            $res->assertOk();

            foreach ($forbiddenKeys as $key) {
                $this->assertArrayNotHasKey($key, $res->json('data'));
                $this->assertArrayNotHasKey($key, $res->json('data.items.0'));
            }
        }

        // 2. Barcode Print Preview endpoint for Owner and Cashier
        $barcodePayload = [
            'items' => [
                ['product_id' => $this->quilt->id, 'quantity' => 2],
            ],
        ];

        foreach ([$this->owner, $this->cashier] as $user) {
            $res = $this->actingAs($user, 'sanctum')->postJson('/api/v1/products/barcodes/print-preview', $barcodePayload);
            $res->assertOk();

            foreach ($forbiddenKeys as $key) {
                $this->assertArrayNotHasKey($key, $res->json('data.labels.0'));
            }
        }
    }

    /**
     * Requirement: Login rate limiting triggers 429 Too Many Requests after 5 failed attempts.
     */
    public function test_login_rate_limiting_protects_against_brute_force(): void
    {
        // 5 failed login attempts
        for ($i = 1; $i <= 5; $i++) {
            $res = $this->postJson('/api/v1/auth/login', [
                'login' => 'cashier_secure',
                'password' => 'WrongPass'.$i,
            ]);
            $res->assertStatus(422)
                ->assertJsonValidationErrors(['login']);
        }

        // 6th attempt must be throttled and return HTTP 429
        $throttledRes = $this->postJson('/api/v1/auth/login', [
            'login' => 'cashier_secure',
            'password' => 'WrongPass6',
        ]);

        $throttledRes->assertStatus(429)
            ->assertJson([
                'success' => false,
                'code' => 'TOO_MANY_REQUESTS',
            ]);
    }

    /**
     * Requirement: Security headers are automatically attached to all API responses.
     */
    public function test_security_headers_are_present_on_api_responses(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertHeader('X-XSS-Protection', '1; mode=block')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
}
