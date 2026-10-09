<?php

namespace Database\Seeders;

use App\Models\ExpenseCategory;
use Illuminate\Database\Seeder;

class ExpenseCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'صيانة عامة', 'code' => 'maintenance', 'is_active' => true],
            ['name' => 'كهرباء ومرافق', 'code' => 'utilities', 'is_active' => true],
            ['name' => 'نقل ومشال', 'code' => 'transport', 'is_active' => true],
            ['name' => 'عمولات وسمسرة', 'code' => 'brokerage', 'is_active' => true],
            ['name' => 'ضيافة ونظافة', 'code' => 'hospitality', 'is_active' => true],
            ['name' => 'تكلفة بضاعة خارجية', 'code' => 'external_product', 'is_active' => true],
        ];

        foreach ($categories as $cat) {
            ExpenseCategory::updateOrCreate(
                ['code' => $cat['code']],
                $cat
            );
        }
    }
}
