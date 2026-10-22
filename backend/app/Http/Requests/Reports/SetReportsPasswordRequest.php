<?php

namespace App\Http\Requests\Reports;

use Illuminate\Foundation\Http\FormRequest;

class SetReportsPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'password' => ['required', 'string', 'min:4'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'رمز الـ PIN الجديد مطلوب.',
            'password.min' => 'يجب ألا يقل رمز الـ PIN عن 4 أرقام/أحرف.',
        ];
    }
}
