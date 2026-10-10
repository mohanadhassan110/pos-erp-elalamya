<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Auth\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CreateCashierCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'make:cashier 
                            {--username= : اسم المستخدم لحساب الكاشير}
                            {--name= : اسم الكاشير}
                            {--password= : كلمة المرور للكاشير}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'إنشاء حساب كاشير جديد بأمان (Al-Alamiya ERP/POS Create Cashier)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('====================================================');
        $this->info(' معرض العالمية للمفروشات — إنشاء حساب كاشير جديد');
        $this->info('====================================================');

        // 1. Resolve Name
        $name = $this->option('name') ?: $this->ask('أدخل اسم الكاشير (مثال: أحمد محمد)');
        $name = trim((string) $name);

        if (empty($name)) {
            $this->error('اسم الكاشير مطلوب.');

            return 1;
        }

        // 2. Resolve Username
        $username = $this->option('username');
        if (empty($username)) {
            $username = $this->ask('أدخل اسم المستخدم لتسجيل الدخول (مثال: cashier1)');
        }

        $username = trim((string) $username);

        $validator = Validator::make(
            ['username' => $username],
            ['username' => ['required', 'string', 'min:3', 'max:50', 'unique:users,username']]
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $err) {
                $this->error($err);
            }

            return 1;
        }

        // 3. Resolve Password
        $password = $this->option('password');
        if (empty($password)) {
            $password = $this->secret('أدخل كلمة المرور للكاشير (8 أحرف على الأقل)');
            $confirmPassword = $this->secret('أعد إدخال كلمة المرور للتأكيد');

            if ($password !== $confirmPassword) {
                $this->error('كلمة المرور وتأكيدها غير متطابقين.');

                return 1;
            }
        }

        if (strlen($password) < 8) {
            $this->error('يجب ألا تقل كلمة المرور عن 8 أحرف.');

            return 1;
        }

        // 4. Create User
        $user = User::create([
            'name' => $name,
            'username' => $username,
            'password' => Hash::make($password),
            'role' => UserRole::CASHIER,
            'is_active' => true,
        ]);

        $this->info('');
        $this->info('✓ تم إنشاء حساب الكاشير بنجاح!');
        $this->info("  - المعرف: {$user->id}");
        $this->info("  - اسم الكاشير: {$user->name}");
        $this->info("  - اسم المستخدم: {$user->username}");
        $this->info('  - الدور: كاشير (Cashier — تشغيلي)');
        $this->info('====================================================');

        return 0;
    }
}
