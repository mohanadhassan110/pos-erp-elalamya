<?php

namespace Tests\Feature\Console;

use App\Domain\Auth\Enums\UserRole;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserManagementCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_make_cashier_command_creates_active_cashier_with_min_8_password(): void
    {
        $this->artisan('make:cashier', [
            '--name' => 'أحمد كاشير',
            '--username' => 'cashier_test',
            '--password' => 'secret1234',
        ])
            ->assertSuccessful();

        $user = User::where('username', 'cashier_test')->first();
        $this->assertNotNull($user);
        $this->assertSame('أحمد كاشير', $user->name);
        $this->assertSame(UserRole::CASHIER, $user->role);
        $this->assertTrue($user->is_active);
        $this->assertTrue(Hash::check('secret1234', $user->password));
    }

    public function test_make_cashier_command_rejects_password_shorter_than_8_chars(): void
    {
        $this->artisan('make:cashier', [
            '--name' => 'كاشير قصير',
            '--username' => 'short_pw_cashier',
            '--password' => 'short12', // 7 chars
        ])
            ->assertFailed();

        $this->assertDatabaseMissing('users', ['username' => 'short_pw_cashier']);
    }

    public function test_user_reset_password_command_updates_password_and_enforces_length(): void
    {
        $user = User::factory()->create([
            'username' => 'existing_cashier',
            'password' => Hash::make('old_password_123'),
        ]);

        // Fails with short password (< 8)
        $this->artisan('user:reset-password', [
            'username' => 'existing_cashier',
            '--password' => '1234567',
        ])->assertFailed();

        // Succeeds with valid password
        $this->artisan('user:reset-password', [
            'username' => 'existing_cashier',
            '--password' => 'new_secure_password_999',
        ])->assertSuccessful();

        $user->refresh();
        $this->assertTrue(Hash::check('new_secure_password_999', $user->password));
    }

    public function test_user_toggle_status_deactivates_user_and_revokes_tokens(): void
    {
        $user = User::factory()->create([
            'username' => 'cashier_to_toggle',
            'is_active' => true,
        ]);

        $token = $user->createToken('test-session');
        $this->assertCount(1, $user->fresh()->tokens);

        // Deactivate
        $this->artisan('user:toggle-status', ['username' => 'cashier_to_toggle'])
            ->assertSuccessful();

        $user->refresh();
        $this->assertFalse($user->is_active);
        $this->assertCount(0, $user->tokens, 'Tokens must be revoked upon deactivation');

        // Deactivated user cannot log in
        $response = $this->postJson('/api/v1/auth/login', [
            'login' => 'cashier_to_toggle',
            'password' => 'password',
        ]);
        $response->assertStatus(422)
            ->assertJsonPath('errors.login.0', 'هذا الحساب معطل، يرجى التواصل مع مسؤول النظام');

        // Request using old plainTextToken fails with 401 Unauthorized
        $this->withToken($token->plainTextToken)
            ->getJson('/api/v1/invoices')
            ->assertUnauthorized();
    }

    public function test_reports_set_password_command_stores_hash_and_allows_unlock(): void
    {
        // 1. Rejects short password via interactive prompt
        $this->artisan('reports:set-password')
            ->expectsQuestion('أدخل كلمة المرور الجديدة لقسم التقارير (6 أحرف/أرقام على الأقل):', '123')
            ->assertFailed();

        // 2. Succeeds via --password-file for automated provisioning
        $tempFile = tempnam(sys_get_temp_dir(), 'rep_pass_');
        file_put_contents($tempFile, 'secureReports99');

        try {
            $this->artisan('reports:set-password', ['--password-file' => $tempFile])
                ->assertSuccessful();

            $hash = Setting::get('reports_password_hash');
            $this->assertNotEmpty($hash);
            $this->assertTrue(Hash::check('secureReports99', $hash));

            // 3. Test first-time unlock flow end-to-end with the real POST /api/v1/reports/unlock endpoint
            $cashier = User::factory()->create([
                'role' => UserRole::CASHIER,
                'is_active' => true,
            ]);

            $unlockRes = $this->actingAs($cashier, 'sanctum')
                ->postJson('/api/v1/reports/unlock', ['password' => 'secureReports99']);
            $unlockRes->assertOk()
                ->assertJsonPath('data.unlocked', true);
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }
}
