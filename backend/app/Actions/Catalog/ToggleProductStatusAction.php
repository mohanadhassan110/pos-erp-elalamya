<?php

namespace App\Actions\Catalog;

use App\Models\AuditLog;
use App\Models\Product;
use App\Models\User;

class ToggleProductStatusAction
{
    public function execute(Product $product, ?bool $status = null, ?User $actor = null): Product
    {
        $oldStatus = $product->is_active;
        $newStatus = $status ?? ! $oldStatus;

        $product->is_active = $newStatus;
        $product->save();

        if ($actor) {
            AuditLog::create([
                'user_id' => $actor->id,
                'action' => $newStatus ? 'product_activated' : 'product_deactivated',
                'auditable_type' => Product::class,
                'auditable_id' => $product->id,
                'old_values' => ['is_active' => $oldStatus],
                'new_values' => ['is_active' => $newStatus],
            ]);
        }

        return $product;
    }
}
