<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class CreateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_id' => ['required', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'purchase_cost' => ['required', 'numeric', 'min:0'],
            'wholesale_price' => ['required', 'numeric', 'min:0'],
            'retail_price' => ['required', 'numeric', 'min:0'],
            'initial_stock' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'category_id.required' => 'فئة المنتج مطلوبة.',
            'category_id.exists' => 'الفئة المحددة غير موجودة.',
            'name.required' => 'اسم المنتج مطلوب.',
            'purchase_cost.required' => 'سعر الشراء الحالي مطلوب.',
            'purchase_cost.numeric' => 'سعر الشراء يجب أن يكون رقماً صحيحاً أو عشرياً صالحاً.',
            'purchase_cost.min' => 'سعر الشراء لا يمكن أن يكون سالباً.',
            'wholesale_price.required' => 'سعر البيع جملة مطلوب.',
            'wholesale_price.min' => 'سعر البيع جملة لا يمكن أن يكون سالباً.',
            'retail_price.required' => 'سعر البيع قطاعي مطلوب.',
            'retail_price.min' => 'سعر البيع قطاعي لا يمكن أن يكون سالباً.',
            'initial_stock.integer' => 'الكمية الافتتاحية يجب أن تكون عدداً صحيحاً.',
            'initial_stock.min' => 'الكمية الافتتاحية لا يمكن أن تكون سالبة.',
        ];
    }
}
