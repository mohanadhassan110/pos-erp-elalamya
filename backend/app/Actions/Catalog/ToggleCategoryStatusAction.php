<?php

namespace App\Actions\Catalog;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\User;

class ToggleCategoryStatusAction
{
    public function execute(Category $category, ?bool $status = null, ?User $actor = null): Category
    {
        $oldStatus = $category->is_active;
        $newStatus = $status ?? ! $oldStatus;

        $category->is_active = $newStatus;
        $category->save();

        if ($actor) {
            AuditLog::create([
                'user_id' => $actor->id,
                'action' => $newStatus ? 'category_activated' : 'category_deactivated',
                'auditable_type' => Category::class,
                'auditable_id' => $category->id,
                'old_values' => ['is_active' => $oldStatus],
                'new_values' => ['is_active' => $newStatus],
            ]);
        }

        return $category;
    }
}
