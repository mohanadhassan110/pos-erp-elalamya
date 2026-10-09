<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class CategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $categoryId = $this->route('category')?->id ?? $this->route('category');

        $codeRules = ['required', 'string', 'size:1', 'regex:/^[a-zA-Z]$/'];
        if ($categoryId) {
            $codeRules[] = 'unique:categories,code,'.$categoryId;
        } else {
            $codeRules[] = 'unique:categories,code';
        }

        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => $codeRules,
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'اسم الفئة مطلوب.',
            'code.required' => 'حرف كود الفئة مطلوب.',
            'code.size' => 'كود الفئة يجب أن يكون حرفاً واحداً فقط.',
            'code.regex' => 'كود الفئة يجب أن يكون حرفاً لاتينياً (A-Z).',
            'code.unique' => 'حرف الفئة مستخدم بالفعل لفئة أخرى.',
        ];
    }
}
