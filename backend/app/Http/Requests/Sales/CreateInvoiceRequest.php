<?php

namespace App\Http\Requests\Sales;

use App\Domain\Sales\Enums\InvoiceItemType;
use App\Domain\Sales\Enums\SaleType;
use App\Models\Customer;
use App\Models\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class CreateInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sale_type' => ['required', Rule::enum(SaleType::class)],
            'customer_id' => [
                $this->input('sale_type') === SaleType::WHOLESALE->value ? 'required' : 'nullable',
                'exists:customers,id',
            ],
            'idempotency_key' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.type' => ['required', Rule::enum(InvoiceItemType::class)],
            'items.*.quantity' => ['required', 'integer', 'gt:0'],
            'items.*.product_id' => [
                'nullable',
                'exists:products,id',
            ],
            'items.*.unit_sale_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.product_name' => [
                'nullable',
                'string',
                'max:255',
            ],
            'items.*.purchase_cost' => [
                'nullable',
                'numeric',
                'min:0',
            ],
            'payments' => ['nullable', 'array'],
            'payments.*.payment_method_id' => ['required', 'exists:payment_methods,id'],
            'payments.*.amount' => ['required', 'numeric', 'gt:0'],
            'payments.*.notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $items = $this->input('items', []);

            if (! is_array($items) || empty($items)) {
                return;
            }

            $productIds = [];
            foreach ($items as $index => $item) {
                $type = $item['type'] ?? null;

                if ($type === InvoiceItemType::PRODUCT->value) {
                    if (empty($item['product_id'])) {
                        $validator->errors()->add("items.{$index}.product_id", 'معرف المنتج مطلوب للأصناف المخزنية.');

                        continue;
                    }

                    $pid = $item['product_id'];
                    if (in_array($pid, $productIds, true)) {
                        $validator->errors()->add("items.{$index}.product_id", 'لا يمكن تكرار نفس المنتج في أكثر من سطر بالفاتورة.');
                    } else {
                        $productIds[] = $pid;
                    }
                } elseif ($type === InvoiceItemType::EXTERNAL->value) {
                    if (empty(trim($item['product_name'] ?? ''))) {
                        $validator->errors()->add("items.{$index}.product_name", 'اسم الصنف الخارجي مطلوب.');
                    }
                    if (! isset($item['purchase_cost']) || ! is_numeric($item['purchase_cost']) || (float) $item['purchase_cost'] < 0) {
                        $validator->errors()->add("items.{$index}.purchase_cost", 'تكلفة شراء الصنف الخارجي مطلوبة ولا يمكن أن تكون سالبة.');
                    }
                    if (! isset($item['unit_sale_price']) || ! is_numeric($item['unit_sale_price']) || (float) $item['unit_sale_price'] < 0) {
                        $validator->errors()->add("items.{$index}.unit_sale_price", 'سعر بيع الصنف الخارجي مطلوب ولا يمكن أن يكون سالباً.');
                    }
                }
            }

            // Verify customer is active if selected
            if ($this->filled('customer_id')) {
                $customer = Customer::find($this->input('customer_id'));
                if ($customer && ! $customer->is_active) {
                    $validator->errors()->add('customer_id', 'العميل المحدد معطل ولا يمكن تسجيل فواتير باسمه.');
                }
            }

            // Verify payment methods are active
            $payments = $this->input('payments', []);
            if (is_array($payments)) {
                foreach ($payments as $index => $payment) {
                    if (! empty($payment['payment_method_id'])) {
                        $pm = PaymentMethod::find($payment['payment_method_id']);
                        if ($pm && ! $pm->is_active) {
                            $validator->errors()->add("payments.{$index}.payment_method_id", 'طريقة الدفع المحددة معطلة.');
                        }
                    }
                }
            }
        });
    }

    public function messages(): array
    {
        return [
            'sale_type.required' => 'نوع البيع مطلوب (قطاعي أو جملة).',
            'customer_id.required' => 'يجب تحديد عميل مسجل لفواتير الجملة.',
            'customer_id.exists' => 'العميل المحدد غير موجود بالنظام.',
            'items.required' => 'يجب إضافة صنف واحد على الأقل في الفاتورة.',
            'items.min' => 'يجب إضافة صنف واحد على الأقل في الفاتورة.',
            'items.*.quantity.required' => 'كمية الصنف مطلوبة.',
            'items.*.quantity.integer' => 'الكمية يجب أن تكون عدداً صحيحاً.',
            'items.*.quantity.gt' => 'الكمية يجب أن تكون أكبر من الصفر.',
            'items.*.unit_sale_price.min' => 'سعر البيع لا يمكن أن يكون سالباً.',
            'payments.*.payment_method_id.required' => 'طريقة الدفع مطلوبة.',
            'payments.*.payment_method_id.exists' => 'طريقة الدفع غير صالحة.',
            'payments.*.amount.required' => 'مبلغ الدفعة مطلوب.',
            'payments.*.amount.gt' => 'مبلغ الدفعة يجب أن يكون أكبر من الصفر.',
        ];
    }
}
