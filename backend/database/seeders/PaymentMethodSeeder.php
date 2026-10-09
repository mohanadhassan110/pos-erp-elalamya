<?php

namespace Database\Seeders;

use App\Models\PaymentMethod;
use Illuminate\Database\Seeder;

class PaymentMethodSeeder extends Seeder
{
    public function run(): void
    {
        $methods = [
            [
                'name' => 'نقدي',
                'code' => 'cash',
                'is_cash' => true,
                'is_active' => true,
            ],
            [
                'name' => 'فودافون كاش',
                'code' => 'vodafone_cash',
                'is_cash' => false,
                'is_active' => true,
            ],
            [
                'name' => 'تحويل بنكي',
                'code' => 'bank_transfer',
                'is_cash' => false,
                'is_active' => true,
            ],
            [
                'name' => 'بطاقة بنكية / فيزا',
                'code' => 'card',
                'is_cash' => false,
                'is_active' => true,
            ],
        ];

        foreach ($methods as $method) {
            PaymentMethod::updateOrCreate(
                ['code' => $method['code']],
                $method
            );
        }
    }
}
