<?php

namespace Tests\Unit\Domain;

use App\Domain\Catalog\Services\BarcodeGenerator;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;

class BarcodeGeneratorTest extends TestCase
{
    use RefreshDatabase;

    public function test_generates_first_sequential_barcode_for_category(): void
    {
        $category = Category::create([
            'name' => 'صالونات',
            'code' => 'S',
            'is_active' => true,
        ]);

        $barcode = BarcodeGenerator::generateForCategory($category);

        $this->assertSame('S0001', $barcode);
        $this->assertTrue(BarcodeGenerator::isValid($barcode));
    }

    public function test_increments_sequential_barcode_correctly(): void
    {
        $category = Category::create([
            'name' => 'غرف نوم',
            'code' => 'B',
            'is_active' => true,
        ]);

        Product::create([
            'category_id' => $category->id,
            'name' => 'غرفة نوم ماستر',
            'barcode' => 'B0001',
            'purchase_cost' => Money::from(10000),
            'wholesale_price' => Money::from(12000),
            'retail_price' => Money::from(15000),
            'stock_quantity' => Quantity::from(2),
            'is_active' => true,
        ]);

        $nextBarcode = BarcodeGenerator::generateForCategory($category);
        $this->assertSame('B0002', $nextBarcode);

        Product::create([
            'category_id' => $category->id,
            'name' => 'غرفة نوم أطفال',
            'barcode' => $nextBarcode,
            'purchase_cost' => Money::from(7000),
            'wholesale_price' => Money::from(8500),
            'retail_price' => Money::from(10000),
            'stock_quantity' => Quantity::from(3),
            'is_active' => true,
        ]);

        $thirdBarcode = BarcodeGenerator::generateForCategory($category);
        $this->assertSame('B0003', $thirdBarcode);
    }

    public function test_different_categories_maintain_independent_sequences(): void
    {
        $categoryA = Category::create(['name' => 'أطقم أنتريه', 'code' => 'A', 'is_active' => true]);
        $categoryB = Category::create(['name' => 'مطابخ', 'code' => 'M', 'is_active' => true]);

        Product::create([
            'category_id' => $categoryA->id,
            'name' => 'أنتريه مودرن',
            'barcode' => 'A0001',
            'purchase_cost' => Money::from(5000),
            'wholesale_price' => Money::from(6000),
            'retail_price' => Money::from(7000),
            'stock_quantity' => Quantity::from(1),
            'is_active' => true,
        ]);

        $barcodeB = BarcodeGenerator::generateForCategory($categoryB);
        $this->assertSame('M0001', $barcodeB);
    }

    public function test_soft_deleted_product_preserves_barcode_sequence_without_collision(): void
    {
        $category = Category::create(['name' => 'كراسي', 'code' => 'C', 'is_active' => true]);

        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'كرسي سفرة',
            'barcode' => 'C0001',
            'purchase_cost' => Money::from(500),
            'wholesale_price' => Money::from(650),
            'retail_price' => Money::from(800),
            'stock_quantity' => Quantity::from(4),
            'is_active' => true,
        ]);

        $product->delete(); // Soft delete

        $nextBarcode = BarcodeGenerator::generateForCategory($category);
        $this->assertSame('C0002', $nextBarcode);
    }

    public function test_rejects_invalid_category_letter(): void
    {
        $category = Category::create(['name' => 'غير صالح', 'code' => '12', 'is_active' => true]);

        $this->expectException(InvalidArgumentException::class);
        BarcodeGenerator::generateForCategory($category);
    }

    public function test_throws_exception_when_category_reaches_maximum_capacity(): void
    {
        $category = Category::create(['name' => 'طاولات', 'code' => 'T', 'is_active' => true]);

        Product::create([
            'category_id' => $category->id,
            'name' => 'طاولة رقم 9999',
            'barcode' => 'T9999',
            'purchase_cost' => Money::from(100),
            'wholesale_price' => Money::from(150),
            'retail_price' => Money::from(200),
            'stock_quantity' => Quantity::from(1),
            'is_active' => true,
        ]);

        $this->expectException(RuntimeException::class);
        BarcodeGenerator::generateForCategory($category);
    }
}
