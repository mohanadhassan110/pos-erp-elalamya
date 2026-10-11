<?php

namespace Tests\Feature\Api\V1\Reports;

use App\Actions\Returns\CreateSalesReturnAction;
use App\Actions\Sales\CreateInvoiceAction;
use App\Domain\Auth\Enums\UserRole;
use App\Domain\Returns\Enums\SalesReturnResolution;
use App\Domain\Sales\Enums\InvoiceStatus;
use App\Domain\Sales\Enums\SaleType;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use App\Services\Reports\SalesReportService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OwnerProfitReportTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;

    protected User $cashier;

    protected PaymentMethod $cashMethod;

    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => UserRole::OWNER, 'is_active' => true]);
        $this->cashier = User::factory()->create(['role' => UserRole::CASHIER, 'is_active' => true]);

        $this->cashMethod = PaymentMethod::firstOrCreate(
            ['code' => 'cash'],
            ['name' => 'نقدي', 'is_cash' => true, 'is_active' => true]
        );

        $this->category = Category::factory()->create([
            'name' => 'مفروشات عامة',
            'code' => 'M',
        ]);

        Setting::set('reports_password_hash', Hash::make('secret123'), 'string', 'security');
    }

    public function test_owner_can_access_invoices_profit_history_unconditionally(): void
    {
        $response = $this->actingAs($this->owner)->getJson('/api/v1/reports/history/invoices');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'items',
                    'totals' => [
                        'total_sales',
                        'cost_of_goods',
                        'gross_profit',
                        'returned_value',
                        'profit_reversal',
                        'net_profit',
                        'average_margin_percentage',
                    ],
                    'note',
                    'pagination',
                ],
            ]);
    }

    public function test_cashier_without_unlock_is_forbidden_with_reports_locked(): void
    {
        $response = $this->actingAs($this->cashier)->getJson('/api/v1/reports/history/invoices');

        $response->assertStatus(403)
            ->assertJson([
                'code' => 'REPORTS_LOCKED',
            ]);
    }

    public function test_cashier_with_active_unlock_can_access_reports_history(): void
    {
        $tokenKey = 'user_'.$this->cashier->id;
        Cache::put("reports_unlocked_token_{$tokenKey}", true, now()->addMinutes(15));

        $response = $this->actingAs($this->cashier)->getJson('/api/v1/reports/history/invoices');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_cashier_operational_invoices_endpoint_never_exposes_cost_or_profit(): void
    {
        $product = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'لحاف قطني',
            'purchase_cost' => 300,
            'retail_price' => 500,
            'wholesale_price' => 450,
            'stock_quantity' => 10,
        ]);

        $createAction = app(CreateInvoiceAction::class);
        $invoice = $createAction->execute([
            'sale_type' => SaleType::RETAIL->value,
            'items' => [
                [
                    'type' => 'product',
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_sale_price' => 500,
                ],
            ],
            'payments' => [
                [
                    'payment_method_id' => $this->cashMethod->id,
                    'amount' => 1000,
                ],
            ],
        ], $this->cashier);

        // Cashier viewing regular invoice list
        $response = $this->actingAs($this->cashier)->getJson('/api/v1/invoices');
        $response->assertStatus(200);
        $response->assertJsonMissingPath('data.0.total_profit');

        // Cashier viewing single invoice details
        $showResponse = $this->actingAs($this->cashier)->getJson("/api/v1/invoices/{$invoice->id}");
        $showResponse->assertStatus(200);
        $showResponse->assertJsonMissingPath('data.total_profit');
        $showResponse->assertJsonMissingPath('data.items.0.unit_cost');
        $showResponse->assertJsonMissingPath('data.items.0.total_cost');
        $showResponse->assertJsonMissingPath('data.items.0.profit');

        // Cashier printable invoice endpoint
        $printResponse = $this->actingAs($this->cashier)->getJson("/api/v1/invoices/{$invoice->id}/print");
        $printResponse->assertStatus(200);
        $printResponse->assertJsonMissingPath('data.items.0.unit_cost');
        $printResponse->assertJsonMissingPath('data.items.0.profit');
    }

    public function test_reconciliation_per_invoice_net_profit_matches_reports_profit_exactly(): void
    {
        $startUtc = Carbon::today('Africa/Cairo')->startOfDay()->utc();
        $endUtc = Carbon::today('Africa/Cairo')->endOfDay()->utc();

        $createSale = app(CreateInvoiceAction::class);
        $returnAction = app(CreateSalesReturnAction::class);

        // Case 1: Normal Sale
        $p1 = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'طقم ملاية عادي',
            'purchase_cost' => 100,
            'retail_price' => 200,
            'wholesale_price' => 180,
            'stock_quantity' => 20,
        ]);
        $inv1 = $createSale->execute([
            'sale_type' => SaleType::RETAIL->value,
            'items' => [
                ['type' => 'product', 'product_id' => $p1->id, 'quantity' => 2, 'unit_sale_price' => 200], // revenue 400, cost 200, profit 200
            ],
            'payments' => [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => 400],
            ],
        ], $this->owner);

        // Case 2: Partial Return
        $p2 = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'بطانية صوف',
            'purchase_cost' => 400,
            'retail_price' => 600,
            'wholesale_price' => 550,
            'stock_quantity' => 20,
        ]);
        $inv2 = $createSale->execute([
            'sale_type' => SaleType::RETAIL->value,
            'items' => [
                ['type' => 'product', 'product_id' => $p2->id, 'quantity' => 3, 'unit_sale_price' => 600], // revenue 1800, cost 1200, profit 600
            ],
            'payments' => [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => 1800],
            ],
        ], $this->owner);
        // Return 1 unit of p2 (return 600, profit reversal (600-400)*1 = 200)
        $inv2Item = $inv2->items()->first();
        $returnAction->execute([
            'invoice_id' => $inv2->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'refund_payment_method_id' => $this->cashMethod->id,
            'items' => [
                ['invoice_item_id' => $inv2Item->id, 'quantity' => 1],
            ],
        ], $this->owner);

        // Case 3: Exchange Case
        $p3A = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'لحاف فيبر',
            'purchase_cost' => 450,
            'retail_price' => 700,
            'wholesale_price' => 650,
            'stock_quantity' => 20,
        ]);
        $p3B = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'بطانية تركي',
            'purchase_cost' => 600,
            'retail_price' => 950,
            'wholesale_price' => 900,
            'stock_quantity' => 20,
        ]);
        $inv3 = $createSale->execute([
            'sale_type' => SaleType::RETAIL->value,
            'items' => [
                ['type' => 'product', 'product_id' => $p3A->id, 'quantity' => 1, 'unit_sale_price' => 700], // profit 250
            ],
            'payments' => [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => 700],
            ],
        ], $this->owner);
        // Customer exchanges 700 for 1 x 950 (pays difference 250)
        $inv3Item = $inv3->items()->first();
        $returnAction->execute([
            'invoice_id' => $inv3->id,
            'resolution' => SalesReturnResolution::EXCHANGE_UPGRADE->value,
            'difference_payment_method_id' => $this->cashMethod->id,
            'items' => [
                ['invoice_item_id' => $inv3Item->id, 'quantity' => 1], // profit reversal 250
            ],
            'replacement_items' => [
                ['product_id' => $p3B->id, 'quantity' => 1, 'unit_sale_price' => 950], // replacement profit (950-600) = 350
            ],
        ], $this->owner);

        // Case 4: Cancelled Invoice
        $p4 = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'مخدة طبية',
            'purchase_cost' => 80,
            'retail_price' => 150,
            'wholesale_price' => 130,
            'stock_quantity' => 20,
        ]);
        $inv4 = $createSale->execute([
            'sale_type' => SaleType::RETAIL->value,
            'items' => [
                ['type' => 'product', 'product_id' => $p4->id, 'quantity' => 1, 'unit_sale_price' => 150],
            ],
            'payments' => [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => 150],
            ],
        ], $this->owner);
        $inv4->status = InvoiceStatus::CANCELLED;
        $inv4->save();

        // Case 5: Policy C External Product (cost 600, sale 900, return 900 -> net -600)
        $inv5 = $createSale->execute([
            'sale_type' => SaleType::RETAIL->value,
            'items' => [
                [
                    'type' => 'external',
                    'product_name' => 'مفرش خارجي عمولة',
                    'purchase_cost' => 600,
                    'quantity' => 1,
                    'unit_sale_price' => 900,
                ],
            ],
            'payments' => [
                ['payment_method_id' => $this->cashMethod->id, 'amount' => 900],
            ],
        ], $this->owner);
        $inv5Item = $inv5->items()->first();
        $returnAction->execute([
            'invoice_id' => $inv5->id,
            'resolution' => SalesReturnResolution::REFUND_CASH->value,
            'refund_payment_method_id' => $this->cashMethod->id,
            'items' => [
                ['invoice_item_id' => $inv5Item->id, 'quantity' => 1],
            ],
        ], $this->owner);

        // Fetch official Reports/Profit endpoint figure
        $salesReportService = app(SalesReportService::class);
        $profitData = $salesReportService->getRealizedProfit($startUtc, $endUtc);
        $expectedNetProfit = $profitData['net_profit'];

        // Fetch new per-invoice profit report endpoint
        $response = $this->actingAs($this->owner)->getJson('/api/v1/reports/history/invoices?from_date='.Carbon::today('Africa/Cairo')->toDateString().'&to_date='.Carbon::today('Africa/Cairo')->toDateString());
        $response->assertStatus(200);

        $reportedTotalNetProfit = $response->json('data.totals.net_profit');

        // Assert exact mathematical reconciliation between per-invoice net profit sum and official reports/profit
        $this->assertEquals(
            $expectedNetProfit,
            $reportedTotalNetProfit,
            "Per-invoice Net Profit sum ({$reportedTotalNetProfit}) must reconcile exactly with reports/profit ({$expectedNetProfit})"
        );
    }

    public function test_performance_check_on_5000_invoices(): void
    {
        $now = now();
        $invoiceRows = [];
        for ($i = 1; $i <= 5000; $i++) {
            $invoiceRows[] = [
                'invoice_number' => sprintf('INV-PERF-%05d', $i),
                'sale_type' => 'retail',
                'status' => 'posted',
                'subtotal' => '500.00',
                'discount_amount' => '0.00',
                'total' => '500.00',
                'paid_amount' => '500.00',
                'remaining_amount' => '0.00',
                'credit_amount' => '0.00',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (array_chunk($invoiceRows, 1000) as $chunk) {
            Invoice::insert($chunk);
        }

        $insertedIds = Invoice::where('invoice_number', 'LIKE', 'INV-PERF-%')->pluck('id')->toArray();
        $itemRows = [];
        foreach ($insertedIds as $invId) {
            $itemRows[] = [
                'invoice_id' => $invId,
                'product_id' => null,
                'item_type' => 'product',
                'product_name' => 'صنف تجريبي أداء',
                'quantity' => 1,
                'unit_sale_price' => '500.00',
                'unit_cost' => '300.00',
                'subtotal' => '500.00',
                'total_cost' => '300.00',
                'profit' => '200.00',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (array_chunk($itemRows, 1000) as $chunk) {
            InvoiceItem::insert($chunk);
        }

        $startTime = microtime(true);
        $response = $this->actingAs($this->owner)->getJson('/api/v1/reports/history/invoices?per_page=15');
        $durationMs = (microtime(true) - $startTime) * 1000;

        $response->assertStatus(200);
        $this->assertCount(15, $response->json('data.items'));
        $this->assertEquals(5000, $response->json('data.pagination.total'));

        // Report timing: must paginate efficiently in under 1500ms
        $this->assertLessThan(1500, $durationMs, "5,000 invoices query took {$durationMs}ms, should be < 1500ms");
    }
}
