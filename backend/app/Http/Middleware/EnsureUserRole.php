<?php

namespace App\Http\Middleware;

use App\Domain\Auth\Enums\UserRole;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserRole
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return ApiResponse::unauthorized();
        }

        if (! $user->is_active) {
            return ApiResponse::forbidden('حساب المستخدم معطل، يرجى التواصل مع الإدارة');
        }

        // If no specific roles required, allow any authenticated active user
        if (empty($roles)) {
            return $next($request);
        }

        $userRoleValue = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;

        if (! in_array($userRoleValue, $roles, true)) {
            $roleLabels = array_map(function ($r) {
                return $r === 'owner' ? 'المالك' : 'الكاشير';
            }, $roles);

            $required = implode(' أو ', $roleLabels);

            return ApiResponse::forbidden("هذا الإجراء مخصص لصلاحية ({$required}) فقط");
        }

        return $next($request);
    }
}
