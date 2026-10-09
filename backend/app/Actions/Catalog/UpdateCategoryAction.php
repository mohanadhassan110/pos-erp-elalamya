<?php

namespace App\Actions\Catalog;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class UpdateCategoryAction
{
    /**
     * Update an existing category.
     * Prevents code mutation if products already exist to protect barcode sequence integrity.
     */
    public function execute(Category $category, array $data, ?User $actor = null): Category
    {
        $oldValues = [
            'name' => $category->name,
            'code' => $category->code,
            'is_active' => $category->is_active,
        ];

        if (isset($data['code'])) {
            $newCode = strtoupper(trim($data['code']));

            if (! preg_match('/^[A-Z]$/', $newCode)) {
                throw ValidationException::withMessages([
                    'code' => ['كود الفئة يجب أن يكون حرفاً إنجليزياً واحداً فقط (A-Z).'],
                ]);
            }

            if ($newCode !== strtoupper($category->code)) {
                // Check if products exist
                if ($category->products()->withTrashed()->exists()) {
                    throw ValidationException::withMessages([
                        'code' => ['لا يمكن تغيير حرف الفئة لوجود منتجات مرتبطة بأكواد باركود تعتمد على هذا الحرف.'],
                    ]);
                }

                // Check collision
                if (Category::where('id', '!=', $category->id)->whereRaw('UPPER(code) = ?', [$newCode])->exists()) {
                    throw ValidationException::withMessages([
                        'code' => ["حرف الفئة '{$newCode}' مستخدم بالفعل في فئة أخرى."],
                    ]);
                }

                $category->code = $newCode;
            }
        }

        if (isset($data['name'])) {
            $category->name = trim($data['name']);
        }

        if (isset($data['is_active'])) {
            $category->is_active = (bool) $data['is_active'];
        }

        $category->save();

        if ($actor) {
            AuditLog::create([
                'user_id' => $actor->id,
                'action' => 'category_updated',
                'auditable_type' => Category::class,
                'auditable_id' => $category->id,
                'old_values' => $oldValues,
                'new_values' => [
                    'name' => $category->name,
                    'code' => $category->code,
                    'is_active' => $category->is_active,
                ],
            ]);
        }

        return $category;
    }
}
