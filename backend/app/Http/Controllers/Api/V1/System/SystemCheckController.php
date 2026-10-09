<?php

namespace App\Http\Controllers\Api\V1\System;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemCheckController extends Controller
{
    /**
     * Endpoint restricted to Owner role only (e.g. reports, settings).
     */
    public function ownerOnly(Request $request): JsonResponse
    {
        return ApiResponse::success([
            'access' => 'granted',
            'role' => $request->user()->role->value,
            'scope' => 'owner_sensitive_area',
        ], 'تم التحقق: صلاحيات المالك مؤكدة');
    }

    /**
     * Endpoint open to both Owner and Cashier roles (operational workflows).
     */
    public function cashierAllowed(Request $request): JsonResponse
    {
        return ApiResponse::success([
            'access' => 'granted',
            'role' => $request->user()->role->value,
            'scope' => 'operational_workflows',
        ], 'تم التحقق: صلاحيات العمليات التشغيلية مؤكدة');
    }
}
