<?php

namespace App\Http\Requests\Returns;

use App\Domain\Returns\Enums\SalesReturnResolution;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateSalesReturnRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'idempotency_key' => ['nullable', 'string', 'max:100'],
            'invoice_id' => ['required', 'integer', 'exists:invoices,id'],
            'resolution' => ['required', 'string', Rule::enum(SalesReturnResolution::class)],
            'notes' => ['nullable', 'string', 'max:1000'],

            // Returned Items
            'items' => ['required', 'array', 'min:1'],
            'items.*.invoice_item_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],

            // Payment for Cash Refund
            'payment_method_id' => ['nullable', 'integer', 'exists:payment_methods,id'],

            // Replacement Items (Exchanges)
            'replacement_items' => ['nullable', 'array'],
            'replacement_items.*.product_id' => ['required_with:replacement_items', 'integer', 'exists:products,id'],
            'replacement_items.*.quantity' => ['required_with:replacement_items', 'integer', 'min:1'],
            'replacement_items.*.unit_sale_price' => ['nullable', 'numeric', 'min:0'],

            // Payment for Exchange Upgrade Difference
            'difference_payment_method_id' => ['nullable', 'integer', 'exists:payment_methods,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'invoice_id.required' => 'رقم الفاتورة الأصلي مطلوب.',
            'invoice_id.exists' => 'فاتورة المبيعات المحددة غير موجودة.',
            'resolution.required' => 'نوع تسوية المرتجع مطلوب.',
            'items.required' => 'يجب تحديد بند واحد على الأقل للمرتجع.',
            'items.min' => 'يجب تحديد بند واحد على الأقل للمرتجع.',
            'items.*.invoice_item_id.required' => 'معرف بند الفاتورة مطلوب.',
            'items.*.quantity.required' => 'كمية المرتجع مطلوبة.',
            'items.*.quantity.min' => 'كمية المرتجع يجب أن تكون 1 على الأقل.',
            'replacement_items.*.product_id.required_with' => 'معرف منتج الاستبدال مطلوب.',
            'replacement_items.*.quantity.required_with' => 'كمية منتج الاستبدال مطلوبة.',
            'replacement_items.*.quantity.min' => 'كمية الاستبدال يجب أن تكون 1 على الأقل.',
        ];
    }
}
