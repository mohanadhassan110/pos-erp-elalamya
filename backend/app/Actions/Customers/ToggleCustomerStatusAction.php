<?php

namespace App\Actions\Customers;

use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\User;

class ToggleCustomerStatusAction
{
    public function execute(Customer $customer, ?bool $status = null, ?User $actor = null): Customer
    {
        $oldStatus = $customer->is_active;
        $newStatus = $status ?? ! $oldStatus;

        $customer->is_active = $newStatus;
        $customer->save();

        if ($actor) {
            AuditLog::create([
                'user_id' => $actor->id,
                'action' => $newStatus ? 'customer_activated' : 'customer_deactivated',
                'auditable_type' => Customer::class,
                'auditable_id' => $customer->id,
                'old_values' => ['is_active' => $oldStatus],
                'new_values' => ['is_active' => $newStatus],
            ]);
        }

        return $customer;
    }
}
