<?php

namespace App\Actions\Catalog;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class CreateCategoryAction
{
    /**
     * Create a category with a validated, unique single-letter code.
     */
    public function execute(array $data, ?User $actor = null): Category
    {
        $code = strtoupper(trim($data['code'] ?? ''));

        if (! preg_match('/^[A-Z]$/', $code)) {
            throw ValidationException::withMessages([
                'code' => ["كود الفئة يجب أن يكون حرفاً إنجليزياً واحداً فقط (A-Z)، القيمة المدخلة: '{$code}'"],
            ]);
        }

        // Case-insensitive check
        if (Category::whereRaw('UPPER(code) = ?', [$code])->exists()) {
            throw ValidationException::withMessages([
                'code' => ["حرف الفئة '{$code}' مستخدم بالفعل في فئة أخرى."],
            ]);
        }

        $category = Category::create([
            'name' => trim($data['name']),
            'code' => $code,
            'is_active' => $data['is_active'] ?? true,
        ]);

        if ($actor) {
            AuditLog::create([
                'user_id' => $actor->id,
                'action' => 'category_created',
                'auditable_type' => Category::class,
                'auditable_id' => $category->id,
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
