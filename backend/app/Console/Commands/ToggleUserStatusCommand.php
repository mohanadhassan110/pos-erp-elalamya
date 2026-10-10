<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class ToggleUserStatusCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:toggle-status 
                            {username? : اسم المستخدم المراد تفعيل/تعطيل حسابه}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'تفعيل أو تعطيل حساب مستخدم (Al-Alamiya Activate/Deactivate User)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $username = $this->argument('username') ?: $this->ask('أدخل اسم المستخدم');
        $username = trim((string) $username);

        $user = User::where('username', $username)->first();
        if (! $user) {
            $this->error("المستخدم '{$username}' غير موجود.");

            return 1;
        }

        $user->is_active = ! $user->is_active;
        $user->save();

        if (! $user->is_active) {
            $user->tokens()->delete();
        }

        $stateText = $user->is_active ? 'تفعيل' : 'تعطيل وإلغاء صلاحياته وجلساته';
        $this->info("✓ تم {$stateText} بنجاح للمستخدم '{$user->username}'.");

        return 0;
    }
}
