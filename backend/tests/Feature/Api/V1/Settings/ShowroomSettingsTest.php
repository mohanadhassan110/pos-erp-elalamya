<?php

namespace Tests\Feature\Api\V1\Settings;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShowroomSettingsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $cashier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $this->cashier = User::factory()->create(['role' => 'cashier', 'is_active' => true]);
    }

    public function test_owner_can_view_showroom_settings(): void
    {
        Setting::set('showroom_phone', '01003116622 - 01010498956');
        Setting::set('showroom_address', 'شارع مسجد النجار المتفرع من شارع بورسعيد، أمام عمارة قيبع بالمنصورة');
        Setting::set('showroom_tagline', 'بيت المفروشات');
        Setting::set('invoice_return_policy', 'الاسترجاع والاستبدال خلال 14 يومًا من تاريخ الفاتورة');
        Setting::set('invoice_thank_you_line', 'شكراً لتعاملكم مع معرض العالمية للمفروشات');

        $response = $this->actingAs($this->owner)
            ->getJson('/api/v1/settings/showroom');

        $response->assertOk()
            ->assertJson([
                'showroom_name' => 'معرض العالمية للمفروشات',
                'phones' => '01003116622 - 01010498956',
                'address' => 'شارع مسجد النجار المتفرع من شارع بورسعيد، أمام عمارة قيبع بالمنصورة',
                'tagline' => 'بيت المفروشات',
                'return_policy' => 'الاسترجاع والاستبدال خلال 14 يومًا من تاريخ الفاتورة',
                'thank_you_line' => 'شكراً لتعاملكم مع معرض العالمية للمفروشات',
            ]);
    }

    public function test_owner_can_update_showroom_settings(): void
    {
        $payload = [
            'phones' => '01003116622, 01010498956',
            'address' => 'شارع مسجد النجار المتفرع من شارع بورسعيد، أمام عمارة قيبع بالمنصورة',
            'tagline' => 'بيت المفروشات',
            'return_policy' => 'الاسترجاع والاستبدال خلال 14 يومًا من تاريخ الفاتورة',
            'thank_you_line' => 'شكراً لتعاملكم معنا',
        ];

        $response = $this->actingAs($this->owner)
            ->putJson('/api/v1/settings/showroom', $payload);

        $response->assertOk()
            ->assertJson([
                'message' => 'تم حفظ بيانات المعرض بنجاح',
                'data' => [
                    'showroom_name' => 'معرض العالمية للمفروشات',
                    'phones' => '01003116622, 01010498956',
                    'address' => 'شارع مسجد النجار المتفرع من شارع بورسعيد، أمام عمارة قيبع بالمنصورة',
                    'tagline' => 'بيت المفروشات',
                    'return_policy' => 'الاسترجاع والاستبدال خلال 14 يومًا من تاريخ الفاتورة',
                    'thank_you_line' => 'شكراً لتعاملكم معنا',
                ],
            ]);

        $this->assertEquals('01003116622, 01010498956', Setting::get('showroom_phone'));
        $this->assertEquals('شارع مسجد النجار المتفرع من شارع بورسعيد، أمام عمارة قيبع بالمنصورة', Setting::get('showroom_address'));
        $this->assertEquals('بيت المفروشات', Setting::get('showroom_tagline'));
    }

    public function test_cashier_cannot_view_showroom_settings(): void
    {
        $response = $this->actingAs($this->cashier)
            ->getJson('/api/v1/settings/showroom');

        $response->assertForbidden();
    }

    public function test_cashier_cannot_update_showroom_settings(): void
    {
        $response = $this->actingAs($this->cashier)
            ->putJson('/api/v1/settings/showroom', [
                'phones' => '01003116622',
            ]);

        $response->assertForbidden();
    }

    public function test_unauthenticated_cannot_access_showroom_settings(): void
    {
        $response = $this->getJson('/api/v1/settings/showroom');
        $response->assertUnauthorized();

        $response = $this->putJson('/api/v1/settings/showroom', []);
        $response->assertUnauthorized();
    }

    public function test_update_validates_field_lengths(): void
    {
        $response = $this->actingAs($this->owner)
            ->putJson('/api/v1/settings/showroom', [
                'phones' => str_repeat('a', 256),
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phones']);
    }
}
