<?php

namespace App\Actions\Auth;

use App\Models\User;

class LogoutUserAction
{
    /**
     * Execute the logout action by deleting current access token.
     */
    public function execute(User $user): void
    {
        $user->currentAccessToken()?->delete();
    }
}
