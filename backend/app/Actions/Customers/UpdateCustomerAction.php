<?php

namespace App\Actions\Customers;

use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\User;

class UpdateCustomerAction
{
    public function execute(Customer $customer, array $data, ?User $actor = null): Customer
    {
        $oldValues = [
            'name' => $customer->name,
            'phone' => $customer->phone,
            'address' => $customer->address,
            'notes' => $customer->notes,
            'is_active' => $customer->is_active,
        ];

        if (isset($data['name'])) {
            $customer->name = trim($data['name']);
        }
        if (array_key_exists('phone', $data)) {
            $customer->phone = $data['phone'] ? trim($data['phone']) : null;
        }
        if (array_key_exists('address', $data)) {
            $customer->address = $data['address'] ? trim($data['address']) : null;
        }
        if (array_key_exists('notes', $data)) {
            $customer->notes = $data['notes'] ? trim($data['notes']) : null;
        }
        if (isset($data['is_active'])) {
            $customer->is_active = (bool) $data['is_active'];
        }

        $customer->save();

        if ($actor) {
            AuditLog::create([
                'user_id' => $actor->id,
                'action' => 'customer_updated',
                'auditable_type' => Customer::class,
                'auditable_id' => $customer->id,
                'old_values' => $oldValues,
                'new_values' => [
                    'name' => $customer->name,
                    'phone' => $customer->phone,
                    'address' => $customer->address,
                    'notes' => $customer->notes,
                    'is_active' => $customer->is_active,
                ],
            ]);
        }

        return $customer;
    }
}
