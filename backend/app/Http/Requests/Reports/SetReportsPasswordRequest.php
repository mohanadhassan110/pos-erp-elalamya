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
            'password' => ['required', 'string', 'min:8'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'كلمة المرور الجديدة لقسم التقارير مطلوبة.',
            'password.min' => 'يجب ألا تقل كلمة مرور التقارير عن 8 أحرف.',
        ];
    }
}
