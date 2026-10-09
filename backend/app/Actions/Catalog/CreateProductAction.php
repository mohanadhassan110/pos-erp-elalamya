<?php

namespace App\Actions\Catalog;

use App\Domain\Catalog\Services\BarcodeGenerator;
use App\Domain\Inventory\Enums\InventoryMovementType;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class CreateProductAction
{
    /**
     * Atomically creates a product, generates its sequential barcode,
     * and records an initial inventory movement if stock > 0.
     */
    public function execute(array $data, ?User $actor = null): Product
    {
        return DB::transaction(function () use ($data, $actor) {
            $category = Category::findOrFail($data['category_id']);

            if (! $category->is_active) {
                throw new InvalidArgumentException('لا يمكن إضافة منتج في فئة معطلة.');
            }

            // Generate deterministic collision-safe barcode
            $barcode = BarcodeGenerator::generateForCategory($category);

            $purchaseCost = Money::fromDecimal($data['purchase_cost']);
            $wholesalePrice = Money::fromDecimal($data['wholesale_price']);
            $retailPrice = Money::fromDecimal($data['retail_price']);

            if ($purchaseCost->isNegative() || $wholesalePrice->isNegative() || $retailPrice->isNegative()) {
                throw new InvalidArgumentException('لا يمكن إدخال أسعار سالبة للمنتج.');
            }

            $initialStock = isset($data['initial_stock'])
                ? Quantity::from($data['initial_stock'])
                : Quantity::zero();

            if ($initialStock->isNegative()) {
                throw new InvalidArgumentException('الكمية الافتتاحية للمخزون لا يمكن أن تكون سالبة.');
            }

            $product = Product::create([
                'category_id' => $category->id,
                'name' => trim($data['name']),
                'barcode' => $barcode,
                'purchase_cost' => $purchaseCost,
                'wholesale_price' => $wholesalePrice,
                'retail_price' => $retailPrice,
                'stock_quantity' => $initialStock,
                'is_active' => $data['is_active'] ?? true,
            ]);

            // Auditable initial stock inventory movement
            if ($initialStock->toInt() > 0) {
                InventoryMovement::create([
                    'product_id' => $product->id,
                    'type' => InventoryMovementType::STOCK_RECEIPT,
                    'quantity' => $initialStock,
                    'unit_cost' => $purchaseCost,
                    'resulting_stock' => $initialStock,
                    'reason' => 'رصيد افتتاحي عند تعريف المنتج بالمعرض',
                    'created_by' => $actor?->id,
                ]);
            }

            if ($actor) {
                AuditLog::create([
                    'user_id' => $actor->id,
                    'action' => 'product_created',
                    'auditable_type' => Product::class,
                    'auditable_id' => $product->id,
                    'new_values' => [
                        'name' => $product->name,
                        'barcode' => $product->barcode,
                        'purchase_cost' => $product->purchase_cost->toDecimal(),
                        'wholesale_price' => $product->wholesale_price->toDecimal(),
                        'retail_price' => $product->retail_price->toDecimal(),
                        'initial_stock' => $initialStock->toInt(),
                    ],
                ]);
            }

            return $product;
        });
    }
}
