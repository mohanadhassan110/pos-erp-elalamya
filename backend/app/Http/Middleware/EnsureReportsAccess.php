<?php

namespace App\Http\Middleware;

use App\Domain\Auth\Enums\UserRole;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class EnsureReportsAccess
{
    /**
     * Handle an incoming request for reports access.
     *
     * Invariants (AGENTS.md & Phase 13-B Owner Decision):
     * 1. Owner always passes without a password.
     * 2. Cashier passes only if a temporary unlock is active for their current Sanctum token (TTL 15m).
     * 3. Otherwise returns 403 with code REPORTS_LOCKED and clear Arabic message.
     * 4. Inactive users are rejected with 403 immediately.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return ApiResponse::unauthorized();
        }

        if (! $user->is_active) {
            return ApiResponse::forbidden('حساب المستخدم معطل، يرجى التواصل مع الإدارة');
        }

        // Owner always has full, unhindered access to reports
        if ($user->role === UserRole::OWNER) {
            return $next($request);
        }

        // Cashier requires an active unlock tied to current Sanctum token
        if ($user->role === UserRole::CASHIER) {
            $token = $user->currentAccessToken();
            $tokenKey = $token?->id ?? ('user_'.$user->id);

            if (Cache::get("reports_unlocked_token_{$tokenKey}")) {
                return $next($request);
            }

            return ApiResponse::error(
                'قسم التقارير مقفل بكلمة مرور، يرجى إدخال كلمة المرور للمتابعة',
                'REPORTS_LOCKED',
                null,
                Response::HTTP_FORBIDDEN
            );
        }

        return ApiResponse::forbidden('غير مصرح لك بالوصول إلى هذا القسم');
    }
}
