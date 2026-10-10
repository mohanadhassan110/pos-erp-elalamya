<?php

namespace App\Http\Controllers\Api\V1\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateShowroomSettingsRequest;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;

class ShowroomSettingsController extends Controller
{
    /**
     * Show current showroom settings.
     * Fixed showroom name: "معرض العالمية للمفروشات".
     */
    public function show(): JsonResponse
    {
        return response()->json([
            'showroom_name' => 'معرض العالمية للمفروشات',
            'phones' => Setting::get('showroom_phone') ?: null,
            'address' => Setting::get('showroom_address') ?: null,
            'tagline' => Setting::get('showroom_tagline') ?: Setting::get('showroom_subtitle') ?: null,
            'return_policy' => Setting::get('invoice_return_policy') ?: Setting::get('return_policy') ?: null,
            'thank_you_line' => Setting::get('invoice_thank_you_line') ?: Setting::get('footer_note') ?: null,
        ]);
    }

    /**
     * Update showroom invoice display settings.
     */
    public function update(UpdateShowroomSettingsRequest $request): JsonResponse
    {
        $validated = $request->validated();

        Setting::set('showroom_name', 'معرض العالمية للمفروشات', 'string', 'general');

        if (array_key_exists('phones', $validated)) {
            Setting::set('showroom_phone', $validated['phones'] ?: '', 'string', 'general');
        }

        if (array_key_exists('address', $validated)) {
            Setting::set('showroom_address', $validated['address'] ?: '', 'string', 'general');
        }

        if (array_key_exists('tagline', $validated)) {
            Setting::set('showroom_tagline', $validated['tagline'] ?: '', 'string', 'general');
            Setting::set('showroom_subtitle', $validated['tagline'] ?: '', 'string', 'general');
        }

        if (array_key_exists('return_policy', $validated)) {
            Setting::set('invoice_return_policy', $validated['return_policy'] ?: '', 'string', 'general');
            Setting::set('return_policy', $validated['return_policy'] ?: '', 'string', 'general');
        }

        if (array_key_exists('thank_you_line', $validated)) {
            Setting::set('invoice_thank_you_line', $validated['thank_you_line'] ?: '', 'string', 'general');
            Setting::set('footer_note', $validated['thank_you_line'] ?: '', 'string', 'general');
        }

        return response()->json([
            'message' => 'تم حفظ بيانات المعرض بنجاح',
            'data' => [
                'showroom_name' => 'معرض العالمية للمفروشات',
                'phones' => Setting::get('showroom_phone') ?: null,
                'address' => Setting::get('showroom_address') ?: null,
                'tagline' => Setting::get('showroom_tagline') ?: null,
                'return_policy' => Setting::get('invoice_return_policy') ?: null,
                'thank_you_line' => Setting::get('invoice_thank_you_line') ?: null,
            ],
        ]);
    }
}
