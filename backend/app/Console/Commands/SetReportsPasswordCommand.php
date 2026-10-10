<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class SetReportsPasswordCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'reports:set-password 
                            {--password-file= : مسار ملف يحتوي على كلمة المرور للتشغيل الآلي}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'تعيين أو تحديث الرقم السري لقسم التقارير (لحسابات الكاشير)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $password = null;

        $passwordFile = $this->option('password-file');
        if ($passwordFile) {
            if (! file_exists($passwordFile)) {
                $this->error("خطأ: ملف كلمة المرور المحدد غير موجود: {$passwordFile}");

                return self::FAILURE;
            }
            $password = trim((string) file_get_contents($passwordFile));
        }

        if (! $password && getenv('REPORTS_PASSWORD')) {
            $password = trim((string) getenv('REPORTS_PASSWORD'));
        }

        if (! $password) {
            $password = $this->secret('أدخل كلمة المرور الجديدة لقسم التقارير (6 أحرف/أرقام على الأقل):');
        }

        if (empty($password) || strlen($password) < 6) {
            $this->error('خطأ: يجب ألا تقل كلمة مرور التقارير عن 6 أحرف أو أرقام.');

            return self::FAILURE;
        }

        Setting::set('reports_password_hash', Hash::make($password), 'string', 'security');

        $this->info('تم تعيين كلمة مرور قسم التقارير بنجاح.');

        return self::SUCCESS;
    }
}
