<?php

namespace Tests\Unit\Domain;

use App\Domain\Sales\Enums\InvoiceItemType;
use App\Domain\Sales\Enums\InvoiceStatus;
use App\Domain\Sales\Enums\SaleType;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\Category;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HistoricalCostTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Mandatory Regression Test according to AGENTS.md Section 4 & Phase 2 Specification Section 35:
     * Product cost 500, sell 2 x 650 => profit 300.
     * Later change product current purchase cost to 600.
     * Historical invoice item cost MUST remain 500, and profit MUST remain 300.
     */
    public function test_invoice_item_preserves_historical_cost_and_profit_when_product_cost_changes(): void
    {
        // 1. Arrange: Create Category and Product with current purchase cost = 500.00
        $category = Category::create([
            'name' => 'غرف سفرة',
            'code' => 'D',
            'is_active' => true,
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'طاولة سفرة 6 كراسي',
            'barcode' => 'D0001',
            'purchase_cost' => Money::from(500),
            'wholesale_price' => Money::from(600),
            'retail_price' => Money::from(650),
            'stock_quantity' => Quantity::from(10),
            'is_active' => true,
        ]);

        $user = User::factory()->create();

        // 2. Create posted invoice with 2 units sold at 650.00
        $salePrice = Money::from(650);
        $historicalCost = $product->purchase_cost; // 500.00
        $quantity = Quantity::from(2);

        $lineCalcs = InvoiceItem::computeLineCalculations($salePrice, $historicalCost, $quantity);

        $invoice = Invoice::create([
            'invoice_number' => 'INV-TEST-001',
            'customer_id' => null,
            'sale_type' => SaleType::RETAIL,
            'status' => InvoiceStatus::POSTED,
            'subtotal' => $lineCalcs['subtotal'],     // 1300.00
            'discount_amount' => Money::zero(),
            'total' => $lineCalcs['subtotal'],        // 1300.00
            'paid_amount' => $lineCalcs['subtotal'],   // 1300.00
            'remaining_amount' => Money::zero(),
            'credit_amount' => Money::zero(),
            'created_by' => $user->id,
        ]);

        $item = InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'product_id' => $product->id,
            'item_type' => InvoiceItemType::PRODUCT,
            'product_name' => $product->name,
            'barcode' => $product->barcode,
            'quantity' => $quantity,
            'unit_sale_price' => $salePrice,
            'unit_cost' => $historicalCost,          // Snapshot 500.00
            'subtotal' => $lineCalcs['subtotal'],     // 1300.00
            'total_cost' => $lineCalcs['total_cost'], // 1000.00
            'profit' => $lineCalcs['profit'],         // 300.00
        ]);

        // Verify initial state
        $this->assertTrue($item->unit_cost->equals(Money::from(500)));
        $this->assertTrue($item->profit->equals(Money::from(300)));
        $this->assertTrue($invoice->calculateTotalProfit()->equals(Money::from(300)));

        // 3. Act: Later, showroom purchase cost for the product increases to 600.00
        $product->update([
            'purchase_cost' => Money::from(600),
        ]);

        $product->refresh();
        $this->assertTrue($product->purchase_cost->equals(Money::from(600)));

        // 4. Assert: Historical invoice item must NOT be affected!
        $item->refresh();
        $invoice->refresh();

        $this->assertTrue(
            $item->unit_cost->equals(Money::from(500)),
            'Invoice item historical unit_cost must remain 500.00, not mutated by product cost change.'
        );

        $this->assertTrue(
            $item->profit->equals(Money::from(300)),
            'Invoice item historical profit must remain 300.00 ((650 - 500) * 2).'
        );

        $this->assertTrue(
            $invoice->calculateTotalProfit()->equals(Money::from(300)),
            'Invoice total profit must remain 300.00.'
        );

        // Current stock valuation uses current cost 600 * 10 = 6000
        $this->assertTrue(
            $product->currentStockValuation()->equals(Money::from(6000)),
            'Current showroom stock valuation correctly uses current purchase cost (600 * 10).'
        );
    }
}
