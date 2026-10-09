<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    /**
     * System health and environment status endpoint.
     */
    public function check(): JsonResponse
    {
        $dbStatus = 'connected';
        try {
            DB::connection()->getPdo();
        } catch (Throwable $e) {
            $dbStatus = 'disconnected';
        }

        return ApiResponse::success([
            'status' => 'operational',
            'system' => 'Al-Alamiya ERP/POS',
            'version' => '1.0.0',
            'api_version' => 'v1',
            'locale' => config('app.locale'),
            'timezone' => config('app.timezone'),
            'server_time' => now()->toIso8601String(),
            'database' => $dbStatus,
        ], 'نظام العالمية ERP يعمل بصورة طبيعية');
    }
}
