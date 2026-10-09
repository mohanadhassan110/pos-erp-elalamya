<?php

namespace App\Http\Requests\Purchasing;

use Illuminate\Foundation\Http\FormRequest;

class ReceiveStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'idempotency_key' => ['nullable', 'string', 'max:64'],
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'received_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id', 'distinct'],
            'items.*.quantity' => ['required', 'integer', 'gt:0'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'supplier_id.exists' => 'المورد المحدد غير موجود بالنظام.',
            'items.required' => 'يجب إدراج منتج واحد على الأقل في إذن الاستلام.',
            'items.min' => 'يجب إدراج منتج واحد على الأقل في إذن الاستلام.',
            'items.*.product_id.required' => 'رقم المنتج مطلوب في كل سطر.',
            'items.*.product_id.exists' => 'أحد المنتجات المحددة غير موجود.',
            'items.*.product_id.distinct' => 'لا يمكن تكرار نفس المنتج في أكثر من سطر بإذن الاستلام الواحد.',
            'items.*.quantity.required' => 'الكمية مطلوبة.',
            'items.*.quantity.integer' => 'الكمية يجب أن تكون عدداً صحيحاً.',
            'items.*.quantity.gt' => 'الكمية يجب أن تكون أكبر من الصفر.',
            'items.*.unit_cost.required' => 'سعر الشراء للوحدة مطلوب.',
            'items.*.unit_cost.min' => 'سعر الشراء للوحدة لا يمكن أن يكون سالباً.',
        ];
    }
}
