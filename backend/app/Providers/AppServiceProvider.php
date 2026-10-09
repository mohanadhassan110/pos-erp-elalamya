<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Rate Limiter for Login Endpoint (brute-force protection: 5 attempts per minute per IP + username)
        RateLimiter::for('login', function (Request $request) {
            $login = (string) $request->input('login', '');

            return Limit::perMinute(5)->by($request->ip().'|'.strtolower(trim($login)));
        });

        // Authorization Gates for Al-Alamiya ERP Foundation
        // Owner-only gates as defined in AGENTS.md Section 23
        Gate::define('access-reports', fn (User $user) => $user->is_active && $user->isOwner());
        Gate::define('manage-settings', fn (User $user) => $user->is_active && $user->isOwner());
        Gate::define('manage-users', fn (User $user) => $user->is_active && $user->isOwner());
        Gate::define('view-audit-logs', fn (User $user) => $user->is_active && $user->isOwner());

        // Operational gates (Owner and Cashier)
        Gate::define('operate-pos', fn (User $user) => $user->is_active);
        Gate::define('manage-catalog', fn (User $user) => $user->is_active);
        Gate::define('manage-inventory', fn (User $user) => $user->is_active);
        Gate::define('manage-customers', fn (User $user) => $user->is_active);
        Gate::define('manage-suppliers', fn (User $user) => $user->is_active);
        Gate::define('manage-expenses', fn (User $user) => $user->is_active);
    }
}
