<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Auth\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_valid_username_and_password(): void
    {
        $user = User::create([
            'name' => 'مالك المعرض',
            'username' => 'owner',
            'email' => 'owner@elalamya.com',
            'password' => Hash::make('password123'),
            'role' => UserRole::OWNER,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'login' => 'owner',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'تم تسجيل الدخول بنجاح',
            ])
            ->assertJsonStructure([
                'success',
                'data' => [
                    'user' => [
                        'id',
                        'name',
                        'username',
                        'email',
                        'role',
                        'role_label',
                        'capabilities',
                    ],
                    'token',
                ],
                'message',
            ]);

        $this->assertEquals('owner', $response->json('data.user.role'));
        $this->assertTrue($response->json('data.user.capabilities.reports_view'));
    }

    public function test_user_can_login_with_valid_email(): void
    {
        User::create([
            'name' => 'كاشير المعرض',
            'username' => 'cashier',
            'email' => 'cashier@elalamya.com',
            'password' => Hash::make('password123'),
            'role' => UserRole::CASHIER,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'login' => 'cashier@elalamya.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'user' => [
                        'username' => 'cashier',
                        'role' => 'cashier',
                        'role_label' => 'كاشير',
                    ],
                ],
            ]);

        // Cashier must not have reports_view permission
        $this->assertFalse($response->json('data.user.capabilities.reports_view'));
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        User::create([
            'name' => 'كاشير المعرض',
            'username' => 'cashier',
            'email' => 'cashier@elalamya.com',
            'password' => Hash::make('password123'),
            'role' => UserRole::CASHIER,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'login' => 'cashier',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'code' => 'VALIDATION_ERROR',
            ])
            ->assertJsonValidationErrors(['login']);
    }

    public function test_login_fails_when_user_is_inactive(): void
    {
        User::create([
            'name' => 'مستخدم معطل',
            'username' => 'inactive_user',
            'email' => 'inactive@elalamya.com',
            'password' => Hash::make('password123'),
            'role' => UserRole::CASHIER,
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'login' => 'inactive_user',
            'password' => 'password123',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'code' => 'VALIDATION_ERROR',
            ]);
    }

    public function test_authenticated_user_can_retrieve_profile(): void
    {
        $user = User::create([
            'name' => 'مالك المعرض',
            'username' => 'owner',
            'email' => 'owner@elalamya.com',
            'password' => Hash::make('password123'),
            'role' => UserRole::OWNER,
            'is_active' => true,
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/v1/auth/me');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'username' => 'owner',
                    'role' => 'owner',
                ],
            ]);
    }

    public function test_unauthenticated_user_cannot_access_protected_endpoint(): void
    {
        $response = $this->getJson('/api/v1/auth/me');

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'code' => 'UNAUTHORIZED',
            ]);
    }

    public function test_user_can_logout(): void
    {
        $user = User::create([
            'name' => 'مالك المعرض',
            'username' => 'owner',
            'email' => 'owner@elalamya.com',
            'password' => Hash::make('password123'),
            'role' => UserRole::OWNER,
            'is_active' => true,
        ]);

        $token = $user->createToken('test-token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/auth/logout');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'تم تسجيل الخروج بنجاح',
            ]);

        $this->assertCount(0, $user->fresh()->tokens);
    }
}
