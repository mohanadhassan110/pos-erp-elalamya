<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Auth\Enums\UserRole;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BarcodePrintTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $cashier;

    private Category $category;

    private Product $quilt;

    private Product $blanket;

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
            'name' => 'مفروشات وألحفة',
            'code' => 'B',
            'is_active' => true,
        ]);

        $this->quilt = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'لحاف قطن فاخر',
            'barcode' => 'B0001',
            'purchase_cost' => 350.00,
            'wholesale_price' => 450.00,
            'retail_price' => 550.00,
            'stock_quantity' => 20,
            'is_active' => true,
        ]);

        $this->blanket = Product::factory()->create([
            'category_id' => $this->category->id,
            'name' => 'بطانية صوف كينج',
            'barcode' => 'B0002',
            'purchase_cost' => 600.00,
            'wholesale_price' => 750.00,
            'retail_price' => 900.00,
            'stock_quantity' => 15,
            'is_active' => true,
        ]);
    }

    public function test_cashier_and_owner_can_access_barcode_preview(): void
    {
        $payload = [
            'items' => [
                ['product_id' => $this->quilt->id, 'quantity' => 3],
                ['product_id' => $this->blanket->id, 'quantity' => 2],
            ],
        ];

        // Cashier check
        $cashierRes = $this->actingAs($this->cashier, 'sanctum')
            ->postJson(route('api.v1.products.barcodes.print-preview'), $payload);

        $cashierRes->assertOk()
            ->assertJsonPath('data.summary.products_count', 2)
            ->assertJsonPath('data.summary.total_labels', 5);

        // Owner check
        $ownerRes = $this->actingAs($this->owner, 'sanctum')
            ->postJson(route('api.v1.products.barcodes.print-preview'), $payload);

        $ownerRes->assertOk()
            ->assertJsonPath('data.summary.products_count', 2)
            ->assertJsonPath('data.summary.total_labels', 5);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->postJson(route('api.v1.products.barcodes.print-preview'), [
            'items' => [['product_id' => $this->quilt->id, 'quantity' => 1]],
        ])->assertUnauthorized();
    }

    public function test_barcode_values_are_preserved_and_never_regenerated(): void
    {
        $initialBarcode = $this->quilt->barcode;
        $this->assertEquals('B0001', $initialBarcode);

        $res = $this->actingAs($this->cashier, 'sanctum')
            ->postJson(route('api.v1.products.barcodes.print-preview'), [
                'items' => [['product_id' => $this->quilt->id, 'quantity' => 4]],
            ]);

        $res->assertOk()
            ->assertJsonPath('data.labels.0.barcode', 'B0001')
            ->assertJsonPath('data.labels.0.print_quantity', 4);

        // Product in DB remains completely unchanged
        $this->quilt->refresh();
        $this->assertEquals('B0001', $this->quilt->barcode);
    }

    public function test_confidentiality_purchase_cost_is_strictly_omitted_from_labels(): void
    {
        $forbiddenKeys = [
            'purchase_cost',
            'unit_cost',
            'total_cost',
            'profit',
            'expense_id',
            'is_external',
            'item_type',
            'cost',
        ];

        // Test with Cashier
        $cashierRes = $this->actingAs($this->cashier, 'sanctum')
            ->postJson(route('api.v1.products.barcodes.print-preview'), [
                'items' => [['product_id' => $this->quilt->id, 'quantity' => 1]],
            ]);

        $cashierRes->assertOk();
        $cashierLabel = $cashierRes->json('data.labels.0');
        foreach ($forbiddenKeys as $key) {
            $this->assertArrayNotHasKey($key, $cashierLabel);
        }
        $this->assertEquals('550.00', $cashierLabel['retail_price']);
        $this->assertStringContainsString('550', $cashierLabel['retail_price_formatted']);

        // Test with Owner
        $ownerRes = $this->actingAs($this->owner, 'sanctum')
            ->postJson(route('api.v1.products.barcodes.print-preview'), [
                'items' => [['product_id' => $this->quilt->id, 'quantity' => 1]],
            ]);

        $ownerRes->assertOk();
        $ownerLabel = $ownerRes->json('data.labels.0');
        foreach ($forbiddenKeys as $key) {
            $this->assertArrayNotHasKey($key, $ownerLabel);
        }
    }

    public function test_validation_rejects_empty_items_or_invalid_quantity(): void
    {
        // Empty items
        $this->actingAs($this->cashier, 'sanctum')
            ->postJson(route('api.v1.products.barcodes.print-preview'), [
                'items' => [],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items']);

        // Zero quantity
        $this->actingAs($this->cashier, 'sanctum')
            ->postJson(route('api.v1.products.barcodes.print-preview'), [
                'items' => [['product_id' => $this->quilt->id, 'quantity' => 0]],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.quantity']);

        // Non-existent product
        $this->actingAs($this->cashier, 'sanctum')
            ->postJson(route('api.v1.products.barcodes.print-preview'), [
                'items' => [['product_id' => 99999, 'quantity' => 1]],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.product_id']);

        // Exceeding 1000 total labels across items
        $this->actingAs($this->cashier, 'sanctum')
            ->postJson(route('api.v1.products.barcodes.print-preview'), [
                'items' => [
                    ['product_id' => $this->quilt->id, 'quantity' => 500],
                    ['product_id' => $this->blanket->id, 'quantity' => 501],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items']);
    }

    public function test_serialized_barcode_label_response_contains_exact_intended_fields_only(): void
    {
        $res = $this->actingAs($this->cashier, 'sanctum')
            ->postJson(route('api.v1.products.barcodes.print-preview'), [
                'items' => [['product_id' => $this->quilt->id, 'quantity' => 2]],
            ]);

        $res->assertOk();
        $label = $res->json('data.labels.0');

        $this->assertSame($this->quilt->id, $label['product_id']);
        $this->assertSame('لحاف قطن فاخر', $label['product_name']);
        $this->assertSame('B0001', $label['barcode']);
        $this->assertSame('مفروشات وألحفة', $label['category_name']);
        $this->assertSame('B', $label['category_code']);
        $this->assertSame('550.00', $label['retail_price']);
        $this->assertSame('450.00', $label['wholesale_price']);
        $this->assertSame(20, $label['stock_quantity']);
        $this->assertSame(2, $label['print_quantity']);

        // Assert strictly forbidden fields do not exist anywhere in the payload
        $this->assertArrayNotHasKey('purchase_cost', $label);
        $this->assertArrayNotHasKey('profit', $label);
        $this->assertArrayNotHasKey('internal_cost', $label);
    }
}
