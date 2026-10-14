<?php

namespace App\Http\Requests\Suppliers;

use Illuminate\Foundation\Http\FormRequest;

class SupplierPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'amount.required' => 'مبلغ الدفعة مطلوب.',
            'amount.numeric' => 'مبلغ الدفعة يجب أن يكون رقماً صحيحاً أو عشرياً.',
            'amount.gt' => 'مبلغ الدفعة يجب أن يكون أكبر من الصفر.',
            'payment_method_id.required' => 'يجب اختيار طريقة الدفع.',
            'payment_method_id.exists' => 'طريقة الدفع المحددة غير موجودة.',
            'notes.max' => 'الملاحظات لا يجب أن تتجاوز 500 حرف.',
        ];
    }
}
