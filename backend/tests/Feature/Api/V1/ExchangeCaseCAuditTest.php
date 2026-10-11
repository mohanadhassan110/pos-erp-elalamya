<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Auth\Enums\UserRole;
use App\Models\Category;
use App\Models\Invoice;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\SalesReturn;
use App\Models\User;
use App\Services\Reports\PaymentReportService;
use App\Services\Reports\SalesReportService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExchangeCaseCAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_exchange_case_c_exact_mathematical_and_accounting_equilibrium(): void
    {
        $owner = User::factory()->create(['role' => UserRole::OWNER, 'is_active' => true]);
        $cashMethod = PaymentMethod::create(['name' => 'نقدي', 'code' => 'cash', 'is_cash' => true, 'is_active' => true]);

        $catL = Category::factory()->create(['name' => 'ألحفة', 'code' => 'L']);
        $catB = Category::factory()->create(['name' => 'بطاطين', 'code' => 'B']);
        $catM = Category::factory()->create(['name' => 'ملايات', 'code' => 'M']);

        // Products
        // 1. Lihaf: cost 450, price 700, stock 10
        $lihaf = Product::factory()->create([
            'category_id' => $catL->id,
            'name' => 'لحاف قطن كينج 3 قطع',
            'barcode' => 'L0001',
            'purchase_cost' => 450,
            'retail_price' => 700,
            'wholesale_price' => 650,
            'stock_quantity' => 10,
        ]);

        // 2. Blanket: cost 650, price 950, stock 10
        $blanket = Product::factory()->create([
            'category_id' => $catB->id,
            'name' => 'بطانية مورانو حفر ليزر 6 كجم',
            'barcode' => 'B0001',
            'purchase_cost' => 650,
            'retail_price' => 950,
            'wholesale_price' => 900,
            'stock_quantity' => 10,
        ]);

        // 3. Sheet set: cost 200, price 350, stock 10
        $sheet = Product::factory()->create([
            'category_id' => $catM->id,
            'name' => 'طقم ملاية قطن مطرز 5 قطع',
            'barcode' => 'M0001',
            'purchase_cost' => 200,
            'retail_price' => 350,
            'wholesale_price' => 300,
            'stock_quantity' => 10,
        ]);

        // Step 1: Create Original Retail Invoice via real API (700 + 950 + 350 = 2000, paid 2000)
        $saleResponse = $this->actingAs($owner)->postJson('/api/v1/invoices', [
            'sale_type' => 'retail',
            'items' => [
                ['product_id' => $lihaf->id, 'type' => 'product', 'quantity' => 1, 'unit_price' => 700],
                ['product_id' => $blanket->id, 'type' => 'product', 'quantity' => 1, 'unit_price' => 950],
                ['product_id' => $sheet->id, 'type' => 'product', 'quantity' => 1, 'unit_price' => 350],
            ],
            'payments' => [
                ['payment_method_id' => $cashMethod->id, 'amount' => 2000],
            ],
            'paid_amount' => 2000,
        ]);

        $saleResponse->assertCreated();
        $origInvId = $saleResponse->json('data.id');
        $origInv = Invoice::with(['items', 'payments'])->find($origInvId);

        $this->assertEquals('2000.00', $origInv->total->toDecimal());
        $this->assertEquals('2000.00', $origInv->paid_amount->toDecimal());
        $this->assertEquals('0.00', $origInv->remaining_amount->toDecimal());

        // Check stock after sale: Lihaf 9, Blanket 9, Sheet 9
        $this->assertEquals(9, $lihaf->fresh()->stock_quantity->toInt());
        $this->assertEquals(9, $blanket->fresh()->stock_quantity->toInt());
        $this->assertEquals(9, $sheet->fresh()->stock_quantity->toInt());

        // Step 2: Return Lihaf (700) and take 2 x Blanket (1900), Customer pays difference 1200
        $lihafItem = $origInv->items->firstWhere('product_id', $lihaf->id);

        $returnResponse = $this->actingAs($owner)->postJson('/api/v1/returns', [
            'invoice_id' => $origInv->id,
            'resolution' => 'exchange_upgrade',
            'items' => [
                ['invoice_item_id' => $lihafItem->id, 'quantity' => 1],
            ],
            'replacement_items' => [
                ['product_id' => $blanket->id, 'quantity' => 2, 'unit_price' => 950],
            ],
            'difference_payment_method_id' => $cashMethod->id,
            'notes' => 'تبديل اللحاف باثنين بطانية ودفع الفارق',
        ]);

        $returnResponse->assertCreated();
        $returnId = $returnResponse->json('data.id');
        $replInvId = $returnResponse->json('data.replacement_invoice_id');

        $salesReturn = SalesReturn::with('items')->find($returnId);
        $replInv = Invoice::with(['items', 'payments'])->find($replInvId);

        // Assert Sales Return record
        $this->assertEquals('700.00', $salesReturn->total_return_amount->toDecimal());
        $this->assertEquals('1200.00', $salesReturn->difference_amount->toDecimal());
        $this->assertEquals($replInvId, $salesReturn->replacement_invoice_id);

        // Assert Replacement Invoice record
        $this->assertEquals('1900.00', $replInv->total->toDecimal());
        $this->assertEquals('1900.00', $replInv->paid_amount->toDecimal());
        $this->assertEquals('0.00', $replInv->remaining_amount->toDecimal());
        $this->assertCount(1, $replInv->payments);
        $this->assertEquals('1200.00', $replInv->payments->first()->amount->toDecimal());

        // Assert Stock equilibrium:
        // Lihaf returned +1 => 10
        // Blanket 2 sold => 9 - 2 = 7
        // Sheet unchanged => 9
        $this->assertEquals(10, $lihaf->fresh()->stock_quantity->toInt());
        $this->assertEquals(7, $blanket->fresh()->stock_quantity->toInt());
        $this->assertEquals(9, $sheet->fresh()->stock_quantity->toInt());

        // Step 3: Assert Reports Output for the day
        $startUtc = Carbon::now()->subMinute();
        $endUtc = Carbon::now()->addMinute();

        $salesService = app(SalesReportService::class);
        $salesSummary = $salesService->getSummary($startUtc, $endUtc);
        $profitSummary = $salesService->getRealizedProfit($startUtc, $endUtc);
        $paymentSummary = app(PaymentReportService::class)->getSummary($startUtc, $endUtc);

        // 1. Cash Inflows: 2000 (orig) + 1200 (diff) = 3200.00
        $this->assertEquals('3200.00', $paymentSummary['cash_inflows']);
        $this->assertEquals('0.00', $paymentSummary['cash_outflows']);
        $this->assertEquals('3200.00', $paymentSummary['net_cash_movement']);

        // 2. Sales Summary:
        // Gross sales = 2000 + 1900 = 3900.00
        // Total returns = 700.00
        // Net sales = 3900 - 700 = 3200.00
        $this->assertEquals('3900.00', $salesSummary['gross_sales']);
        $this->assertEquals('700.00', $salesSummary['total_returns']);
        $this->assertEquals('3200.00', $salesSummary['net_sales']);
        $this->assertEquals('1900.00', $salesSummary['replacement_sales']);
        $this->assertEquals('1200.00', $salesSummary['difference_collected_total']);

        // 3. Profit Summary:
        // Orig invoice gross profit = (700-450) + (950-650) + (350-200) = 250 + 300 + 150 = 700.00
        // Repl invoice gross profit = 2 * (950-650) = 600.00
        // Total gross profit = 700 + 600 = 1300.00
        // Profit reversal from Lihaf return = (700-450) * 1 = 250.00
        // Net Profit = 1300 - 250 = 1050.00
        $this->assertEquals('1300.00', $profitSummary['gross_profit']);
        $this->assertEquals('250.00', $profitSummary['profit_reversal']);
        $this->assertEquals('1050.00', $profitSummary['net_profit']);
    }
}
