<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\LoginUserAction;
use App\Actions\Auth\LogoutUserAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    /**
     * Authenticate user and issue Sanctum token.
     */
    public function login(LoginRequest $request, LoginUserAction $action): JsonResponse
    {
        $result = $action->execute($request->validated());

        return ApiResponse::success([
            'user' => new UserResource($result['user']),
            'token' => $result['token'],
        ], 'تم تسجيل الدخول بنجاح');
    }

    /**
     * Log out authenticated user.
     */
    public function logout(Request $request, LogoutUserAction $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $action->execute($user);

        return ApiResponse::success(null, 'تم تسجيل الخروج بنجاح');
    }

    /**
     * Get authenticated user profile.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return ApiResponse::success(
            new UserResource($user),
            'تم استرجاع بيانات المستخدم بنجاح'
        );
    }
}
