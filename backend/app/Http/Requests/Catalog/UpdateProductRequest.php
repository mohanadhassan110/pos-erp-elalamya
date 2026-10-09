<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_id' => ['sometimes', 'exists:categories,id'],
            'name' => ['sometimes', 'string', 'max:255'],
            'purchase_cost' => ['sometimes', 'numeric', 'min:0'],
            'wholesale_price' => ['sometimes', 'numeric', 'min:0'],
            'retail_price' => ['sometimes', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'category_id.exists' => 'الفئة المحددة غير موجودة.',
            'purchase_cost.min' => 'سعر الشراء لا يمكن أن يكون سالباً.',
            'wholesale_price.min' => 'سعر البيع جملة لا يمكن أن يكون سالباً.',
            'retail_price.min' => 'سعر البيع قطاعي لا يمكن أن يكون سالباً.',
        ];
    }
}
