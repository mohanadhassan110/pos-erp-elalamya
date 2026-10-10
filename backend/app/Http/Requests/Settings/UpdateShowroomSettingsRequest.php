<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdateShowroomSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'phones' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'tagline' => ['nullable', 'string', 'max:255'],
            'return_policy' => ['nullable', 'string', 'max:1000'],
            'thank_you_line' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'phones.max' => 'أرقام الهواتف لا يجب أن تتجاوز 255 حرفاً',
            'address.max' => 'العنوان لا يجب أن يتجاوز 500 حرف',
            'tagline.max' => 'الشعار لا يجب أن يتجاوز 255 حرفاً',
            'return_policy.max' => 'سياسة الاسترجاع لا يجب أن تتجاوز 1000 حرف',
            'thank_you_line.max' => 'عبارة الشكر لا يجب أن تتجاوز 500 حرف',
        ];
    }
}
