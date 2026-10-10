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
use App\Models\Setting;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
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
            'name' => 'عميل تجريبي',
            'phone' => '01011223344',
            'address' => 'عنوان تجريبي',
            'is_active' => true,
        ]);

        $this->supplier = Supplier::create([
            'name' => 'مورد تجريبي',
            'phone' => '01099887766',
            'address' => 'عنوان تجريبي',
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
     * In Phase 13-B, reports endpoints are protected by password gate (REPORTS_LOCKED).
     */
    public function test_cashier_is_locked_out_of_reports_by_default_and_forbidden_from_owner_endpoints(): void
    {
        $reportEndpoints = [
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

        foreach ($reportEndpoints as $uri) {
            $response = $this->actingAs($this->cashier, 'sanctum')->getJson($uri);
            $response->assertStatus(403)
                ->assertJson([
                    'success' => false,
                    'code' => 'REPORTS_LOCKED',
                ]);
        }

        // System owner-check remains strictly FORBIDDEN for cashier
        $ownerCheckResponse = $this->actingAs($this->cashier, 'sanctum')->getJson('/api/v1/system/owner-check');
        $ownerCheckResponse->assertStatus(403)
            ->assertJson([
                'success' => false,
                'code' => 'FORBIDDEN',
            ]);
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

    /**
     * Requirement Phase 13-B: Reports Password Gate Unlock & Lock Lifecycle.
     */
    public function test_reports_password_gate_unlock_and_lock_lifecycle(): void
    {
        // 1. Owner sets the reports password
        $setPassRes = $this->actingAs($this->owner, 'sanctum')->postJson('/api/v1/reports/password', [
            'password' => 'ReportsSecret2026',
        ]);
        $setPassRes->assertOk()
            ->assertJson(['success' => true]);

        // Verify hashed storage in settings table
        $this->assertNotEmpty(Setting::get('reports_password_hash'));
        $this->assertNotEquals('ReportsSecret2026', Setting::get('reports_password_hash'));
        $this->assertTrue(Hash::check('ReportsSecret2026', Setting::get('reports_password_hash')));

        // 2. Cashier attempts unlock with wrong password
        $wrongUnlockRes = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/reports/unlock', [
            'password' => 'WrongReportsPass',
        ]);
        $wrongUnlockRes->assertStatus(422)
            ->assertJson([
                'success' => false,
                'code' => 'INVALID_PASSWORD',
            ]);

        // Cashier still locked out
        $this->actingAs($this->cashier, 'sanctum')
            ->getJson('/api/v1/reports/overview')
            ->assertStatus(403)
            ->assertJson(['code' => 'REPORTS_LOCKED']);

        // 3. Cashier unlocks with correct password
        $correctUnlockRes = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/reports/unlock', [
            'password' => 'ReportsSecret2026',
        ]);
        $correctUnlockRes->assertOk()
            ->assertJson([
                'success' => true,
                'data' => [
                    'unlocked' => true,
                    'expires_in_minutes' => 15,
                ],
            ]);

        // 4. Cashier can now access reports overview
        $overviewRes = $this->actingAs($this->cashier, 'sanctum')->getJson('/api/v1/reports/overview');
        $overviewRes->assertOk()
            ->assertJson(['success' => true]);

        // 5. Cashier manually locks reports
        $lockRes = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/reports/lock');
        $lockRes->assertOk()
            ->assertJson([
                'success' => true,
                'data' => ['unlocked' => false],
            ]);

        // Cashier is locked out again
        $this->actingAs($this->cashier, 'sanctum')
            ->getJson('/api/v1/reports/overview')
            ->assertStatus(403)
            ->assertJson(['code' => 'REPORTS_LOCKED']);
    }

    /**
     * Requirement Phase 13-B: Reports Unlock expires after TTL (15 minutes).
     */
    public function test_reports_unlock_expires_after_ttl(): void
    {
        Setting::set('reports_password_hash', Hash::make('ReportsSecret2026'), 'string', 'security');

        // Cashier unlocks
        $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/reports/unlock', [
            'password' => 'ReportsSecret2026',
        ])->assertOk();

        // Immediate access succeeds
        $this->actingAs($this->cashier, 'sanctum')->getJson('/api/v1/reports/overview')->assertOk();

        // Fast-forward 16 minutes (TTL is 15 minutes)
        $this->travel(16)->minutes();

        // Access is now locked out
        $this->actingAs($this->cashier, 'sanctum')
            ->getJson('/api/v1/reports/overview')
            ->assertStatus(403)
            ->assertJson(['code' => 'REPORTS_LOCKED']);
    }

    /**
     * Requirement Phase 13-B: Reports unlock does NOT survive logout.
     */
    public function test_reports_unlock_does_not_survive_logout(): void
    {
        Setting::set('reports_password_hash', Hash::make('ReportsSecret2026'), 'string', 'security');

        // 1. Cashier logs in via API
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'login' => 'cashier_secure',
            'password' => 'CashierSecurePass123',
        ]);
        $token1 = $loginRes->json('data.token');

        // 2. Unlock reports with token 1
        $this->withHeader('Authorization', 'Bearer '.$token1)
            ->postJson('/api/v1/reports/unlock', ['password' => 'ReportsSecret2026'])
            ->assertOk();

        // Access works
        $this->withHeader('Authorization', 'Bearer '.$token1)
            ->getJson('/api/v1/reports/overview')
            ->assertOk();

        // 3. Cashier logs out
        $this->withHeader('Authorization', 'Bearer '.$token1)
            ->postJson('/api/v1/auth/logout')
            ->assertOk();

        auth('sanctum')->forgetUser();

        // Old token is revoked
        $this->withHeader('Authorization', 'Bearer '.$token1)
            ->getJson('/api/v1/reports/overview')
            ->assertStatus(401);

        // 4. Cashier logs in again, receiving a NEW token
        $loginRes2 = $this->postJson('/api/v1/auth/login', [
            'login' => 'cashier_secure',
            'password' => 'CashierSecurePass123',
        ]);
        $token2 = $loginRes2->json('data.token');

        // New token is locked by default and requires fresh unlock
        $this->withHeader('Authorization', 'Bearer '.$token2)
            ->getJson('/api/v1/reports/overview')
            ->assertStatus(403)
            ->assertJson(['code' => 'REPORTS_LOCKED']);
    }

    /**
     * Requirement Phase 13-B: Unlocking reports grants access to reports ONLY.
     * purchase_cost, profit, and internal markers must remain strictly hidden on non-report endpoints.
     */
    public function test_unlocking_reports_does_not_leak_cost_on_non_report_endpoints(): void
    {
        Setting::set('reports_password_hash', Hash::make('ReportsSecret2026'), 'string', 'security');

        // Cashier unlocks reports
        $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/reports/unlock', [
            'password' => 'ReportsSecret2026',
        ])->assertOk();

        // Create a posted invoice
        $invoice = Invoice::create([
            'invoice_number' => 'INV-20261009-CONF01',
            'sale_type' => SaleType::RETAIL,
            'status' => InvoiceStatus::POSTED,
            'subtotal' => Money::from(1000),
            'discount_amount' => Money::zero(),
            'total' => Money::from(1000),
            'paid_amount' => Money::from(1000),
            'remaining_amount' => Money::zero(),
            'credit_amount' => Money::zero(),
            'created_by' => $this->cashier->id,
        ]);

        $item = InvoiceItem::create([
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

        // Cashier views invoice - internal profit/costs MUST still be null!
        $invoiceRes = $this->actingAs($this->cashier, 'sanctum')->getJson("/api/v1/invoices/{$invoice->id}");
        $invoiceRes->assertOk();
        $this->assertNull($invoiceRes->json('data.total_profit'));
        $this->assertNull($invoiceRes->json('data.items.0.unit_cost'));
        $this->assertNull($invoiceRes->json('data.items.0.total_cost'));
        $this->assertNull($invoiceRes->json('data.items.0.profit'));

        // Customer printable invoice remains strictly clean
        $printRes = $this->actingAs($this->cashier, 'sanctum')->getJson("/api/v1/invoices/{$invoice->id}/print");
        $printRes->assertOk();
        $this->assertNull($printRes->json('data.items.0.unit_cost'));
        $this->assertNull($printRes->json('data.items.0.profit'));
    }

    /**
     * Requirement Phase 13-B: Rate limiting on reports unlock endpoint (5 attempts/min).
     */
    public function test_reports_unlock_rate_limiting(): void
    {
        Setting::set('reports_password_hash', Hash::make('ReportsSecret2026'), 'string', 'security');

        RateLimiter::clear($this->cashier->id.'|127.0.0.1');

        // 5 wrong attempts
        for ($i = 1; $i <= 5; $i++) {
            $res = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/reports/unlock', [
                'password' => 'WrongPass'.$i,
            ]);
            $res->assertStatus(422)
                ->assertJson(['code' => 'INVALID_PASSWORD']);
        }

        // 6th attempt must be throttled with HTTP 429
        $throttledRes = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/reports/unlock', [
            'password' => 'ReportsSecret2026',
        ]);
        $throttledRes->assertStatus(429)
            ->assertJson(['code' => 'TOO_MANY_REQUESTS']);
    }

    /**
     * Requirement Phase 13-B: Owner does not require any password for reports.
     */
    public function test_owner_does_not_require_password_for_reports(): void
    {
        $reportEndpoints = [
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

        foreach ($reportEndpoints as $uri) {
            $response = $this->actingAs($this->owner, 'sanctum')->getJson($uri);
            $response->assertOk()
                ->assertJson(['success' => true]);
        }
    }

    /**
     * Requirement Phase 13-B: Cashier cannot set or change the reports password.
     */
    public function test_cashier_cannot_change_reports_password(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/reports/password', [
            'password' => 'HackedPassword123',
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'code' => 'FORBIDDEN',
            ]);
    }

    /**
     * Requirement Phase 13-B: Login rate limiter allows correct login after fewer-than-limit failed attempts.
     */
    public function test_login_rate_limiter_allows_correct_login_after_fewer_than_limit_failures(): void
    {
        RateLimiter::clear('127.0.0.1|cashier_secure');

        // 3 failed attempts
        for ($i = 1; $i <= 3; $i++) {
            $this->postJson('/api/v1/auth/login', [
                'login' => 'cashier_secure',
                'password' => 'WrongPassword',
            ])->assertStatus(422);
        }

        // 4th attempt with correct password succeeds
        $successRes = $this->postJson('/api/v1/auth/login', [
            'login' => 'cashier_secure',
            'password' => 'CashierSecurePass123',
        ]);

        $successRes->assertOk()
            ->assertJson(['success' => true])
            ->assertJsonStructure(['data' => ['user', 'token']]);
    }

    /**
     * Requirement Phase 13-B Task B: POST invoices and POST returns responses do not leak cost or profit.
     */
    public function test_cashier_post_invoice_and_post_return_responses_do_not_leak_cost_or_profit(): void
    {
        // 1. Cashier posts a retail sale
        $invoiceRes = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/invoices', [
            'sale_type' => 'retail',
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $this->quilt->id,
                    'quantity' => 2,
                    'unit_sale_price' => 1000.00,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 2000.00,
                ],
            ],
        ]);

        $invoiceRes->assertStatus(201);
        $this->assertNull($invoiceRes->json('data.total_profit'));
        $this->assertNull($invoiceRes->json('data.items.0.unit_cost'));
        $this->assertNull($invoiceRes->json('data.items.0.total_cost'));
        $this->assertNull($invoiceRes->json('data.items.0.profit'));

        $invoiceId = $invoiceRes->json('data.id');
        $itemId = $invoiceRes->json('data.items.0.id');

        // 2. Cashier posts a return for the sale
        $returnRes = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/returns', [
            'invoice_id' => $invoiceId,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [
                [
                    'invoice_item_id' => $itemId,
                    'quantity' => 1,
                ],
            ],
            'payment_method_id' => $this->cashMethod->id,
        ]);

        $returnRes->assertStatus(201);
        $this->assertNull($returnRes->json('data.total_profit_reversed'));
        $this->assertNull($returnRes->json('data.items.0.unit_cost'));
        $this->assertNull($returnRes->json('data.items.0.profit_reversal'));
    }

    /**
     * Requirement Phase 13-B Task B: Customer and Supplier responses do not leak internal costs or profit.
     */
    public function test_customer_and_supplier_endpoints_do_not_leak_cost_or_profit(): void
    {
        $forbiddenKeys = ['purchase_cost', 'unit_cost', 'total_cost', 'profit', 'total_profit', 'expense_id'];

        // Customers GET & POST
        $custIndex = $this->actingAs($this->cashier, 'sanctum')->getJson('/api/v1/customers');
        $custIndex->assertOk();
        foreach ($forbiddenKeys as $key) {
            $this->assertArrayNotHasKey($key, $custIndex->json('data.0') ?? []);
        }

        $custShow = $this->actingAs($this->cashier, 'sanctum')->getJson("/api/v1/customers/{$this->customer->id}");
        $custShow->assertOk();
        foreach ($forbiddenKeys as $key) {
            $this->assertArrayNotHasKey($key, $custShow->json('data') ?? []);
        }

        // Suppliers GET, POST, & Add-Balance
        $suppIndex = $this->actingAs($this->cashier, 'sanctum')->getJson('/api/v1/suppliers');
        $suppIndex->assertOk();
        foreach ($forbiddenKeys as $key) {
            $this->assertArrayNotHasKey($key, $suppIndex->json('data.0') ?? []);
        }

        $suppShow = $this->actingAs($this->cashier, 'sanctum')->getJson("/api/v1/suppliers/{$this->supplier->id}");
        $suppShow->assertOk();
        foreach ($forbiddenKeys as $key) {
            $this->assertArrayNotHasKey($key, $suppShow->json('data') ?? []);
        }

        $balanceRes = $this->actingAs($this->cashier, 'sanctum')->postJson("/api/v1/suppliers/{$this->supplier->id}/add-balance", [
            'amount' => 500.00,
            'description' => 'فاتورة شراء 20 قطعة لحاف',
        ]);
        $balanceRes->assertStatus(201);
        foreach ($forbiddenKeys as $key) {
            $this->assertArrayNotHasKey($key, $balanceRes->json('supplier') ?? []);
        }
    }

    /**
     * Requirement Phase 13-B Task C: Cross-entity IDOR prevention on returns.
     */
    public function test_cross_entity_idor_prevention_on_returns(): void
    {
        // Create Invoice 1 with an item
        $inv1 = Invoice::create([
            'invoice_number' => 'INV-20261009-IDOR1',
            'sale_type' => SaleType::RETAIL,
            'status' => InvoiceStatus::POSTED,
            'subtotal' => Money::from(1000),
            'discount_amount' => Money::zero(),
            'total' => Money::from(1000),
            'paid_amount' => Money::from(1000),
            'created_by' => $this->owner->id,
        ]);
        $item1 = InvoiceItem::create([
            'invoice_id' => $inv1->id,
            'product_id' => $this->quilt->id,
            'item_type' => InvoiceItemType::PRODUCT,
            'product_name' => $this->quilt->name,
            'quantity' => Quantity::from(1),
            'unit_sale_price' => Money::from(1000),
            'unit_cost' => Money::from(600),
            'subtotal' => Money::from(1000),
            'total_cost' => Money::from(600),
            'profit' => Money::from(400),
        ]);

        // Create Invoice 2 with a different item
        $inv2 = Invoice::create([
            'invoice_number' => 'INV-20261009-IDOR2',
            'sale_type' => SaleType::RETAIL,
            'status' => InvoiceStatus::POSTED,
            'subtotal' => Money::from(1000),
            'discount_amount' => Money::zero(),
            'total' => Money::from(1000),
            'paid_amount' => Money::from(1000),
            'created_by' => $this->owner->id,
        ]);

        // Malicious attempt: Return on Invoice 2 using Item 1 from Invoice 1
        $res = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/returns', [
            'invoice_id' => $inv2->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'items' => [
                [
                    'invoice_item_id' => $item1->id,
                    'quantity' => 1,
                ],
            ],
            'payment_method_id' => $this->cashMethod->id,
        ]);

        // Must fail with validation error / domain exception (not succeed)
        $this->assertContains($res->status(), [400, 422]);
        $this->assertFalse($res->json('success') ?? true);
    }

    /**
     * Requirement Phase 13-B Task C: APP_DEBUG=false does not leak stack traces or raw SQL.
     */
    public function test_app_debug_false_does_not_leak_stack_traces_or_sql(): void
    {
        config(['app.debug' => false]);

        // Request a non-existent route to trigger a 404
        $res = $this->getJson('/api/v1/non-existent-endpoint-test');
        $res->assertStatus(404);

        $json = $res->json();
        $this->assertArrayNotHasKey('trace', $json);
        $this->assertArrayNotHasKey('exception', $json);
        $this->assertArrayNotHasKey('file', $json);
        $this->assertArrayNotHasKey('line', $json);
        $this->assertStringNotContainsString('SQLSTATE', $res->getContent());
    }

    /**
     * Requirement Phase 14 Part 1.4: Reports password unconfigured behavior.
     * Cashier cannot unlock; owner retains unhindered access.
     */
    public function test_reports_password_not_configured_rejects_cashier_unlock_while_owner_retains_access(): void
    {
        Setting::where('key', 'reports_password_hash')->delete();

        // Cashier tries to unlock when no password is set
        $cashierRes = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/reports/unlock', [
            'password' => 'AnyPassword123',
        ]);
        $cashierRes->assertStatus(422)
            ->assertJson([
                'success' => false,
                'code' => 'REPORTS_PASSWORD_NOT_CONFIGURED',
            ]);

        // Cashier accessing reports gets 403 REPORTS_LOCKED
        $this->actingAs($this->cashier, 'sanctum')
            ->getJson('/api/v1/reports/overview')
            ->assertStatus(403)
            ->assertJson(['code' => 'REPORTS_LOCKED']);

        // Owner still accesses reports unconditionally
        $this->actingAs($this->owner, 'sanctum')
            ->getJson('/api/v1/reports/overview')
            ->assertOk()
            ->assertJson(['success' => true]);
    }

    /**
     * Requirement Phase 14 Part 1.4: Rate limiting and unlock state are isolated per user.
     */
    public function test_failed_unlock_attempts_of_user_a_do_not_affect_user_b(): void
    {
        Setting::set('reports_password_hash', Hash::make('ReportsPass2026'), 'string', 'security');

        $cashierB = User::factory()->create([
            'username' => 'cashier_b',
            'role' => UserRole::CASHIER,
            'is_active' => true,
        ]);

        RateLimiter::clear($this->cashier->id.'|127.0.0.1');
        RateLimiter::clear($cashierB->id.'|127.0.0.1');

        // Cashier A exhausts 5 attempts
        for ($i = 1; $i <= 5; $i++) {
            $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/reports/unlock', [
                'password' => 'WrongPass',
            ])->assertStatus(422);
        }

        // Cashier A is throttled on 6th
        $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/reports/unlock', [
            'password' => 'ReportsPass2026',
        ])->assertStatus(429);

        // Cashier B can still unlock successfully with correct password!
        $resB = $this->actingAs($cashierB, 'sanctum')->postJson('/api/v1/reports/unlock', [
            'password' => 'ReportsPass2026',
        ]);
        $resB->assertOk()
            ->assertJson(['success' => true]);
    }

    /**
     * Requirement Phase 14 Part 1.4: User deactivation immediately invalidates reports access.
     */
    public function test_deactivated_user_is_immediately_locked_out_even_with_previously_active_unlock(): void
    {
        Setting::set('reports_password_hash', Hash::make('ReportsPass2026'), 'string', 'security');

        // Cashier unlocks
        $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/reports/unlock', [
            'password' => 'ReportsPass2026',
        ])->assertOk();

        // Immediate access works
        $this->actingAs($this->cashier, 'sanctum')->getJson('/api/v1/reports/overview')->assertOk();

        // Deactivate cashier
        $this->cashier->update(['is_active' => false]);

        // Access must now be immediately forbidden
        $this->actingAs($this->cashier->fresh(), 'sanctum')
            ->getJson('/api/v1/reports/overview')
            ->assertStatus(403)
            ->assertJson(['code' => 'FORBIDDEN']);
    }

    /**
     * Requirement Phase 14 Part 1.1: Cashier operational cost visibility per Owner Decision.
     * Cashier MAY see purchase_cost and valuation on products, inventory, and stock receipts.
     * Cashier MUST NOT see profit, expense_id, is_external, item_type.
     */
    public function test_cashier_operational_cost_visibility_on_inventory_products_and_stock_receipts(): void
    {
        $forbiddenKeys = ['profit', 'expense_id', 'is_external', 'item_type', 'total_profit'];

        // 1. Products index and show
        $prodIndex = $this->actingAs($this->cashier, 'sanctum')->getJson('/api/v1/products');
        $prodIndex->assertOk();
        $this->assertNotNull($prodIndex->json('data.0.purchase_cost')); // Cashier MAY see purchase_cost
        foreach ($forbiddenKeys as $key) {
            $this->assertArrayNotHasKey($key, $prodIndex->json('data.0') ?? []);
        }

        // 2. Inventory index
        $invIndex = $this->actingAs($this->cashier, 'sanctum')->getJson('/api/v1/inventory');
        $invIndex->assertOk();
        $this->assertNotNull($invIndex->json('data.0.current_purchase_cost')); // Cashier MAY see current_purchase_cost
        $this->assertNotNull($invIndex->json('data.0.stock_valuation'));
        foreach ($forbiddenKeys as $key) {
            $this->assertArrayNotHasKey($key, $invIndex->json('data.0') ?? []);
        }

        // 3. Stock receipts store & index
        $receiptRes = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/v1/stock-receipts', [
            'supplier_id' => $this->supplier->id,
            'items' => [
                [
                    'product_id' => $this->quilt->id,
                    'quantity' => 5,
                    'unit_cost' => 650.00,
                ],
            ],
            'notes' => 'استلام بضاعة ألحفة',
        ]);
        $receiptRes->assertStatus(201);
        $this->assertNotNull($receiptRes->json('data.total_cost')); // Cashier MAY see receipt total_cost
        foreach ($forbiddenKeys as $key) {
            $this->assertArrayNotHasKey($key, $receiptRes->json('data') ?? []);
            $this->assertArrayNotHasKey($key, $receiptRes->json('data.items.0') ?? []);
        }
    }
}
