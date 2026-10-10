<?php

namespace Database\Seeders;

use App\Domain\Auth\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with default operational users.
     */
    public function run(): void
    {
        if (app()->environment('production')) {
            throw new \RuntimeException('لا يمكن تشغيل DatabaseSeeder في بيئة الإنتاج لمنع حقن حسابات تجريبية بكلمات مرور افتراضية. استخدم ProductionSeeder وأمر make:owner بدلاً منه.');
        }

        // 1. Owner account
        User::updateOrCreate(
            ['username' => 'owner'],
            [
                'name' => 'مالك المعرض',
                'email' => 'owner@elalamya.com',
                'password' => Hash::make('password123'),
                'role' => UserRole::OWNER,
                'is_active' => true,
            ]
        );

        // 2. Cashier account
        User::updateOrCreate(
            ['username' => 'cashier'],
            [
                'name' => 'كاشير المعرض',
                'email' => 'cashier@elalamya.com',
                'password' => Hash::make('password123'),
                'role' => UserRole::CASHIER,
                'is_active' => true,
            ]
        );

        // 3. Operational Master Data Seeders
        $this->call([
            PaymentMethodSeeder::class,
            ExpenseCategorySeeder::class,
        ]);
    }
}
