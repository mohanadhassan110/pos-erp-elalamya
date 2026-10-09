<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class BarcodePrintPreviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'items.required' => 'يجب تحديد منتج واحد على الأقل لطباعة الباركود.',
            'items.min' => 'يجب تحديد منتج واحد على الأقل لطباعة الباركود.',
            'items.max' => 'لا يمكن طباعة باركود لأكثر من 100 منتج مختلف في المرة الواحدة.',
            'items.*.product_id.required' => 'معرف المنتج مطلوب.',
            'items.*.product_id.exists' => 'أحد المنتجات المحددة غير موجود.',
            'items.*.quantity.required' => 'عدد الملصقات مطلوب.',
            'items.*.quantity.min' => 'يجب أن يكون عدد الملصقات 1 على الأقل.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $items = $this->input('items', []);
            if (is_array($items)) {
                $totalQuantity = array_reduce($items, function ($carry, $item) {
                    return $carry + (int) ($item['quantity'] ?? 0);
                }, 0);

                if ($totalQuantity > 1000) {
                    $validator->errors()->add('items', 'الحد الأقصى لإجمالي عدد الملصقات في أمر الطباعة الواحد هو 1000 ملصق.');
                }
            }
        });
    }
}
