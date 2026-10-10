<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class ResetPasswordCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:reset-password 
                            {username? : اسم المستخدم المراد تغيير كلمة مروره}
                            {--password= : كلمة المرور الجديدة}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'تغيير أو إعادة تعيين كلمة مرور مستخدم بأمان (Al-Alamiya Reset Password)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $username = $this->argument('username') ?: $this->ask('أدخل اسم المستخدم المراد تغيير كلمة مروره');
        $username = trim((string) $username);

        $user = User::where('username', $username)->first();
        if (! $user) {
            $this->error("المستخدم '{$username}' غير موجود.");

            return 1;
        }

        $password = $this->option('password');
        if (empty($password)) {
            $password = $this->secret('أدخل كلمة المرور الجديدة (8 أحرف على الأقل)');
            $confirm = $this->secret('أعد إدخال كلمة المرور للتأكيد');

            if ($password !== $confirm) {
                $this->error('كلمة المرور وتأكيدها غير متطابقين.');

                return 1;
            }
        }

        if (strlen($password) < 8) {
            $this->error('يجب ألا تقل كلمة المرور عن 8 أحرف.');

            return 1;
        }

        $user->password = Hash::make($password);
        $user->save();

        // Revoke all existing Sanctum tokens for security
        $user->tokens()->delete();

        $this->info("✓ تم تحديث كلمة المرور للمستخدم '{$user->username}' بنجاح، وتم إلغاء كافة الجلسات النشطة.");

        return 0;
    }
}
