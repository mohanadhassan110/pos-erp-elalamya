<?php

namespace Tests\Feature\Api\V1;

use Tests\TestCase;

class HealthTest extends TestCase
{
    public function test_health_check_returns_operational_status(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'operational',
                    'system' => 'Al-Alamiya ERP/POS',
                    'version' => '1.0.0',
                    'api_version' => 'v1',
                    'timezone' => 'Africa/Cairo',
                    'locale' => 'ar',
                ],
            ]);
    }
}
