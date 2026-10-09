<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Auth\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $cashier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'مالك المعرض',
            'username' => 'owner',
            'email' => 'owner@elalamya.com',
            'password' => Hash::make('password123'),
            'role' => UserRole::OWNER,
            'is_active' => true,
        ]);

        $this->cashier = User::create([
            'name' => 'كاشير المعرض',
            'username' => 'cashier',
            'email' => 'cashier@elalamya.com',
            'password' => Hash::make('password123'),
            'role' => UserRole::CASHIER,
            'is_active' => true,
        ]);
    }

    public function test_owner_can_access_owner_only_endpoint(): void
    {
        $response = $this->actingAs($this->owner, 'sanctum')
            ->getJson('/api/v1/system/owner-check');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'access' => 'granted',
                    'role' => 'owner',
                ],
            ]);
    }

    public function test_cashier_is_forbidden_from_owner_only_endpoint(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')
            ->getJson('/api/v1/system/owner-check');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'code' => 'FORBIDDEN',
            ]);
    }

    public function test_both_owner_and_cashier_can_access_operational_endpoint(): void
    {
        // Owner access
        $ownerResponse = $this->actingAs($this->owner, 'sanctum')
            ->getJson('/api/v1/system/cashier-check');

        $ownerResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'access' => 'granted',
                    'role' => 'owner',
                ],
            ]);

        // Cashier access
        $cashierResponse = $this->actingAs($this->cashier, 'sanctum')
            ->getJson('/api/v1/system/cashier-check');

        $cashierResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'access' => 'granted',
                    'role' => 'cashier',
                ],
            ]);
    }
}
