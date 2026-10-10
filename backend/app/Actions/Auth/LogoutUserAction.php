<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

class LogoutUserAction
{
    /**
     * Execute the logout action by deleting current access token and clearing session unlocks.
     */
    public function execute(User $user): void
    {
        $token = $user->currentAccessToken();

        if ($token) {
            $tokenKey = $token->id ?? ('user_'.$user->id);
            Cache::forget("reports_unlocked_token_{$tokenKey}");
            $token->delete();
        }
    }
}
