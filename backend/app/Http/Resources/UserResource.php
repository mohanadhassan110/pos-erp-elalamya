<?php

namespace App\Http\Resources;

use App\Domain\Auth\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property User $resource
 */
class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var User $user */
        $user = $this->resource;
        $role = $user->role instanceof UserRole ? $user->role : UserRole::tryFrom((string) $user->role);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'role' => $role?->value ?? 'cashier',
            'role_label' => $role?->label() ?? 'كاشير',
            'is_active' => (bool) $user->is_active,
            'capabilities' => $role?->capabilities() ?? [],
            'created_at' => $user->created_at?->toISOString(),
        ];
    }
}
