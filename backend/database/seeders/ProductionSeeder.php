<?php

namespace Database\Seeders;

use App\Models\ExpenseCategory;
use App\Models\PaymentMethod;
use App\Models\Setting;
use Illuminate\Database\Seeder;

class ProductionSeeder extends Seeder
{
    /**
     * Seed only required production master reference data.
     * Never creates demo products, demo invoices, demo customers, or hardcoded accounts.
     */
    public function run(): void
    {
        // 1. Core Payment Methods
        $paymentMethods = [
            [
                'code' => 'cash',
                'name' => 'نقدي (كاش)',
                'is_cash' => true,
                'is_active' => true,
            ],
            [
                'code' => 'vodafone_cash',
                'name' => 'فودافون كاش (محفظة إلكترونية)',
                'is_cash' => false,
                'is_active' => true,
            ],
            [
                'code' => 'bank_transfer',
                'name' => 'تحويل بنكي / إنستاباي',
                'is_cash' => false,
                'is_active' => true,
            ],
            [
                'code' => 'card',
                'name' => 'بطاقة بنكية (فيزا / ميزة)',
                'is_cash' => false,
                'is_active' => true,
            ],
            [
                'code' => 'other',
                'name' => 'أخرى',
                'is_cash' => false,
                'is_active' => true,
            ],
        ];

        foreach ($paymentMethods as $pm) {
            PaymentMethod::updateOrCreate(
                ['code' => $pm['code']],
                $pm
            );
        }

        // 2. Core Expense Categories
        $expenseCategories = [
            [
                'code' => 'general_operations',
                'name' => 'مصروفات تشغيلية وعامة',
                'is_active' => true,
            ],
            [
                'code' => 'external_product',
                'name' => 'تكلفة بضاعة خارجية',
                'is_active' => true,
            ],
        ];

        foreach ($expenseCategories as $ec) {
            ExpenseCategory::updateOrCreate(
                ['code' => $ec['code']],
                $ec
            );
        }

        // 3. Base Showroom Settings (Official Identity)
        $baseSettings = [
            'showroom_name' => ['value' => 'معرض العالمية للمفروشات', 'type' => 'string', 'group' => 'general'],
            'showroom_subtitle' => ['value' => 'أرقى المفروشات العصرية والمنزلية', 'type' => 'string', 'group' => 'general'],
            'showroom_address' => ['value' => 'المعرض الرئيسي - المحلة الكبرى', 'type' => 'string', 'group' => 'general'],
            'showroom_phone' => ['value' => '01000000000', 'type' => 'string', 'group' => 'general'],
            'return_policy' => ['value' => 'البضاعة المباعة ترد وتستبدل خلال 14 يوماً بأصل الفاتورة بحالتها الأصلية', 'type' => 'string', 'group' => 'general'],
            'footer_note' => ['value' => 'شكراً لتعاملكم مع معرض العالمية للمفروشات', 'type' => 'string', 'group' => 'general'],
            'currency' => ['value' => 'ج.م', 'type' => 'string', 'group' => 'general'],
        ];

        foreach ($baseSettings as $key => $conf) {
            Setting::set($key, $conf['value'], $conf['type'], $conf['group']);
        }
    }
}
