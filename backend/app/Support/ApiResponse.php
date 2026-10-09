<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class ApiResponse
{
    /**
     * Return a standardized successful JSON response.
     */
    public static function success(mixed $data = null, ?string $message = null, int $status = Response::HTTP_OK): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
            'message' => $message,
        ], $status);
    }

    /**
     * Return a standardized error JSON response.
     */
    public static function error(
        string $message,
        ?string $code = null,
        mixed $errors = null,
        int $status = Response::HTTP_BAD_REQUEST
    ): JsonResponse {
        $payload = [
            'success' => false,
            'message' => $message,
        ];

        if ($code !== null) {
            $payload['code'] = $code;
        }

        if ($errors !== null) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status);
    }

    /**
     * Return a standardized validation error response (422 Unprocessable Entity).
     */
    public static function validationError(array $errors, string $message = 'خطأ في التحقق من صحة البيانات'): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'code' => 'VALIDATION_ERROR',
            'errors' => $errors,
        ], Response::HTTP_UNPROCESSABLE_ENTITY);
    }

    /**
     * Return a standardized 401 Unauthorized response.
     */
    public static function unauthorized(string $message = 'يجب تسجيل الدخول أولاً للوصول إلى هذا المورد'): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'code' => 'UNAUTHORIZED',
        ], Response::HTTP_UNAUTHORIZED);
    }

    /**
     * Return a standardized 403 Forbidden response.
     */
    public static function forbidden(string $message = 'غير مصرح لك بتنفيذ هذه العملية'): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'code' => 'FORBIDDEN',
        ], Response::HTTP_FORBIDDEN);
    }

    /**
     * Return a standardized 404 Not Found response.
     */
    public static function notFound(string $message = 'المورد المطلوب غير موجود'): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'code' => 'NOT_FOUND',
        ], Response::HTTP_NOT_FOUND);
    }

    /**
     * Return a standardized 500 Internal Server Error response without leaking internals.
     */
    public static function serverError(string $message = 'حدث خطأ غير متوقع في النظام، يرجى المحاولة لاحقاً'): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'code' => 'INTERNAL_SERVER_ERROR',
        ], Response::HTTP_INTERNAL_SERVER_ERROR);
    }
}
