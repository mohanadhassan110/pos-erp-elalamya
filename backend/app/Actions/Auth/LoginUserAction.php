<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginUserAction
{
    /**
     * Execute the login action.
     *
     * @param  array{login: string, password: string, device_name?: string|null}  $data
     * @return array{user: User, token: string}
     *
     * @throws ValidationException
     */
    public function execute(array $data): array
    {
        $login = trim($data['login']);
        $password = $data['password'];
        $deviceName = $data['device_name'] ?? 'pos-client';

        /** @var User|null $user */
        $user = User::query()
            ->where('username', $login)
            ->orWhere('email', $login)
            ->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['بيانات الدخول غير صحيحة، يرجى التأكد من اسم المستخدم وكلمة المرور'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'login' => ['هذا الحساب معطل، يرجى التواصل مع مسؤول النظام'],
            ]);
        }

        $token = $user->createToken($deviceName)->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }
}
