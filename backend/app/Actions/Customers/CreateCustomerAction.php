<?php

namespace App\Actions\Customers;

use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\User;

class CreateCustomerAction
{
    public function execute(array $data, ?User $actor = null): Customer
    {
        $customer = Customer::create([
            'name' => trim($data['name']),
            'phone' => isset($data['phone']) ? trim($data['phone']) : null,
            'address' => isset($data['address']) ? trim($data['address']) : null,
            'notes' => isset($data['notes']) ? trim($data['notes']) : null,
            'is_active' => $data['is_active'] ?? true,
        ]);

        if ($actor) {
            AuditLog::create([
                'user_id' => $actor->id,
                'action' => 'customer_created',
                'auditable_type' => Customer::class,
                'auditable_id' => $customer->id,
                'new_values' => [
                    'name' => $customer->name,
                    'phone' => $customer->phone,
                    'is_active' => $customer->is_active,
                ],
            ]);
        }

        return $customer;
    }
}
