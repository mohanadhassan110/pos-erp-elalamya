<?php

namespace App\Http\Requests\Suppliers;

use Illuminate\Foundation\Http\FormRequest;

class AddSupplierBalanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'gt:0'],
            'description' => ['required', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'amount.required' => 'مبلغ الرصيد المضاف مطلوب.',
            'amount.numeric' => 'مبلغ الرصيد يجب أن يكون رقماً صالحاً.',
            'amount.gt' => 'مبلغ الرصيد يجب أن يكون أكبر من الصفر.',
            'description.required' => 'بيان/تفاصيل إضافة الرصيد مطلوب (مثل: فاتورة شراء 20 لحاف).',
        ];
    }
}
