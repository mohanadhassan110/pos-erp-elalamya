<?php

namespace App\Actions\Catalog;

use App\Domain\Support\Money;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use InvalidArgumentException;

class UpdateProductAction
{
    /**
     * Updates an existing product.
     * Note: Barcode is permanent and immutable.
     * Current cost updates future sales only; historical invoice items remain untouched.
     */
    public function execute(Product $product, array $data, ?User $actor = null): Product
    {
        $oldValues = [
            'name' => $product->name,
            'purchase_cost' => $product->purchase_cost->toDecimal(),
            'wholesale_price' => $product->wholesale_price->toDecimal(),
            'retail_price' => $product->retail_price->toDecimal(),
            'category_id' => $product->category_id,
            'is_active' => $product->is_active,
        ];

        if (isset($data['name'])) {
            $product->name = trim($data['name']);
        }

        if (isset($data['category_id']) && $data['category_id'] !== $product->category_id) {
            $newCategory = Category::findOrFail($data['category_id']);
            if (! $newCategory->is_active) {
                throw new InvalidArgumentException('لا يمكن نقل المنتج إلى فئة معطلة.');
            }
            $product->category_id = $newCategory->id;
        }

        $costChanged = false;
        if (isset($data['purchase_cost'])) {
            $newCost = Money::fromDecimal($data['purchase_cost']);
            if ($newCost->isNegative()) {
                throw new InvalidArgumentException('سعر الشراء لا يمكن أن يكون سالباً.');
            }
            if (! $product->purchase_cost->equals($newCost)) {
                $costChanged = true;
                $product->purchase_cost = $newCost;
            }
        }

        if (isset($data['wholesale_price'])) {
            $newWholesale = Money::fromDecimal($data['wholesale_price']);
            if ($newWholesale->isNegative()) {
                throw new InvalidArgumentException('سعر الجملة لا يمكن أن يكون سالباً.');
            }
            $product->wholesale_price = $newWholesale;
        }

        if (isset($data['retail_price'])) {
            $newRetail = Money::fromDecimal($data['retail_price']);
            if ($newRetail->isNegative()) {
                throw new InvalidArgumentException('سعر القطاعي لا يمكن أن يكون سالباً.');
            }
            $product->retail_price = $newRetail;
        }

        if (isset($data['is_active'])) {
            $product->is_active = (bool) $data['is_active'];
        }

        $product->save();

        if ($actor) {
            $action = $costChanged ? 'product_cost_and_price_updated' : 'product_updated';

            AuditLog::create([
                'user_id' => $actor->id,
                'action' => $action,
                'auditable_type' => Product::class,
                'auditable_id' => $product->id,
                'old_values' => $oldValues,
                'new_values' => [
                    'name' => $product->name,
                    'purchase_cost' => $product->purchase_cost->toDecimal(),
                    'wholesale_price' => $product->wholesale_price->toDecimal(),
                    'retail_price' => $product->retail_price->toDecimal(),
                    'category_id' => $product->category_id,
                    'is_active' => $product->is_active,
                ],
            ]);
        }

        return $product;
    }
}
