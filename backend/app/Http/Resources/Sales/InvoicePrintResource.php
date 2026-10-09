<?php

namespace App\Http\Resources\Sales;

use App\Domain\Sales\Enums\SaleType;
use App\Models\Invoice;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Customer-Facing Printable Invoice Resource.
 *
 * Confidentiality Invariants (AGENTS.md & Phase 12 Constitution):
 * 1. Strictly hides product purchase cost, historical unit cost, and total cost.
 * 2. Strictly hides invoice profit and line-item profits.
 * 3. Strictly hides internal expense records and polymorphic external cost links.
 * 4. Normalizes external items so they appear as ordinary product lines to the customer,
 *    without exposing external workshop/supplier markers or internal classifications.
 * 5. Provides complete wholesale transparency: prior balance, invoice total, amount paid,
 *    and resulting balance or credit.
 * 6. Supports anonymous retail sales gracefully.
 *
 * @mixin Invoice
 */
class InvoicePrintResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $customerData = null;
        if ($this->customer) {
            $balances = $this->calculateCustomerBalances();
            $priorBalance = $balances['prior_balance'];
            $resultingBalance = $balances['resulting_balance'];

            $balanceStatus = 'خالص';
            if ($resultingBalance->isPositive()) {
                $balanceStatus = 'مدين (مستحق على العميل)';
            } elseif ($resultingBalance->isNegative()) {
                $balanceStatus = 'دائن (رصيد للعميل)';
            }

            $customerData = [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'phone' => $this->customer->phone,
                'address' => $this->customer->address,
                'prior_balance' => $priorBalance->toDecimal(),
                'prior_balance_formatted' => $priorBalance->formattedArabic(),
                'resulting_balance' => $resultingBalance->toDecimal(),
                'resulting_balance_formatted' => $resultingBalance->formattedArabic(),
                'balance_status' => $balanceStatus,
            ];
        }

        // Map items to clean, customer-facing representation without any cost, profit, or external flags
        $printableItems = $this->items->map(function ($item) {
            return [
                'id' => $item->id,
                'product_name' => $item->product_name,
                'barcode' => $item->barcode,
                'quantity' => $item->quantity->toInt(),
                'unit_price' => $item->unit_sale_price->toDecimal(),
                'unit_price_formatted' => $item->unit_sale_price->formattedArabic(),
                'subtotal' => $item->subtotal->toDecimal(),
                'subtotal_formatted' => $item->subtotal->formattedArabic(),
            ];
        });

        // Map payments
        $printablePayments = $this->payments->map(function ($payment) {
            return [
                'id' => $payment->id,
                'payment_method_id' => $payment->payment_method_id,
                'payment_method_name' => $payment->paymentMethod?->name ?? 'نقدي',
                'amount' => $payment->amount->toDecimal(),
                'amount_formatted' => $payment->amount->formattedArabic(),
                'notes' => $payment->notes,
                'paid_at' => $payment->created_at?->format('Y-m-d H:i'),
            ];
        });

        $showroomName = Setting::get('showroom_name', 'العالمية للأثاث والموبيليا');
        $showroomSubtitle = Setting::get('showroom_subtitle', 'معرض المفروشات المنزلية والأثاث الراقي');
        $showroomPhone = Setting::get('showroom_phone', '01000000000');
        $showroomAddress = Setting::get('showroom_address', 'المعرض الرئيسي - دمياط');
        $returnPolicy = Setting::get('invoice_return_policy', 'البضاعة المباعة ترد وتستبدل خلال 14 يوماً وفقاً لأحكام قانون حماية المستهلك ولائحة المعرض بشرط وجود أصل الفاتورة وسلامة المنتج بحالته الأصلية.');

        return [
            'id' => $this->id,
            'invoice_number' => $this->invoice_number,
            'issue_date' => $this->created_at?->format('Y-m-d H:i'),
            'issue_date_arabic' => $this->created_at?->translatedFormat('d F Y - h:i A') ?? $this->created_at?->format('Y-m-d H:i'),
            'sale_type' => $this->sale_type->value,
            'sale_type_label' => $this->sale_type->label(),
            'is_wholesale' => $this->sale_type === SaleType::WHOLESALE,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'customer' => $customerData,
            'items' => $printableItems,
            'items_count' => $this->items->count(),
            'total_units' => $this->items->sum(fn ($i) => $i->quantity->toInt()),
            'subtotal' => $this->subtotal->toDecimal(),
            'subtotal_formatted' => $this->subtotal->formattedArabic(),
            'discount_amount' => $this->discount_amount->toDecimal(),
            'discount_amount_formatted' => $this->discount_amount->formattedArabic(),
            'total' => $this->total->toDecimal(),
            'total_formatted' => $this->total->formattedArabic(),
            'paid_amount' => $this->paid_amount->toDecimal(),
            'paid_amount_formatted' => $this->paid_amount->formattedArabic(),
            'remaining_amount' => $this->remaining_amount->toDecimal(),
            'remaining_amount_formatted' => $this->remaining_amount->formattedArabic(),
            'credit_amount' => $this->credit_amount->toDecimal(),
            'credit_amount_formatted' => $this->credit_amount->formattedArabic(),
            'payments' => $printablePayments,
            'notes' => $this->notes,
            'cashier_name' => $this->creator?->name ?? 'كاشير المعرض',
            'showroom' => [
                'name' => $showroomName,
                'subtitle' => $showroomSubtitle,
                'phone' => $showroomPhone,
                'address' => $showroomAddress,
                'return_policy' => $returnPolicy,
                'footer_note' => 'شكراً لتعاملكم مع معرض العالمية للأثاث والموبيليا',
            ],
        ];
    }
}
