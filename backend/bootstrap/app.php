<?php

use App\Http\Middleware\EnsureUserRole;
use App\Http\Middleware\ForceJsonResponse;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'role' => EnsureUserRole::class,
        ]);

        $middleware->api(prepend: [
            ForceJsonResponse::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Uniform API Error Handling for /api/* routes
        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                return ApiResponse::validationError(
                    $e->errors(),
                    'بيانات غير صالحة، يرجى مراجعة الحقول المطلوبة'
                );
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                return ApiResponse::unauthorized('يجب تسجيل الدخول أولاً للوصول إلى هذا المورد');
            }
        });

        $exceptions->render(function (AuthorizationException|AccessDeniedHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                return ApiResponse::forbidden($e->getMessage() ?: 'غير مصرح لك بتنفيذ هذه العملية');
            }
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                return ApiResponse::notFound('المورد المطلوب غير موجود');
            }
        });

        $exceptions->render(function (HttpException $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                if ($e->getStatusCode() === 429) {
                    return ApiResponse::error(
                        'تجاوزت الحد المسموح من المحاولات، يرجى الانتظار والمحاولة لاحقاً',
                        'TOO_MANY_REQUESTS',
                        null,
                        429
                    );
                }

                return ApiResponse::error(
                    $e->getMessage() ?: 'حدث خطأ في الطلب',
                    'HTTP_ERROR',
                    null,
                    $e->getStatusCode()
                );
            }
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                if (config('app.debug')) {
                    return ApiResponse::error(
                        $e->getMessage(),
                        'SERVER_DEBUG_ERROR',
                        [
                            'exception' => get_class($e),
                            'file' => $e->getFile(),
                            'line' => $e->getLine(),
                        ],
                        500
                    );
                }

                return ApiResponse::serverError('حدث خطأ غير متوقع في الخادم، يرجى المحاولة لاحقاً');
            }
        });
    })->create();
