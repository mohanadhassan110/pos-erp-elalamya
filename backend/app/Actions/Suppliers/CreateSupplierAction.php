<?php

namespace App\Actions\Suppliers;

use App\Models\AuditLog;
use App\Models\Supplier;
use App\Models\User;

class CreateSupplierAction
{
    public function execute(array $data, ?User $actor = null): Supplier
    {
        $supplier = Supplier::create([
            'name' => trim($data['name']),
            'phone' => isset($data['phone']) ? trim($data['phone']) : null,
            'address' => isset($data['address']) ? trim($data['address']) : null,
            'notes' => isset($data['notes']) ? trim($data['notes']) : null,
            'is_active' => $data['is_active'] ?? true,
        ]);

        if ($actor) {
            AuditLog::create([
                'user_id' => $actor->id,
                'action' => 'supplier_created',
                'auditable_type' => Supplier::class,
                'auditable_id' => $supplier->id,
                'new_values' => [
                    'name' => $supplier->name,
                    'phone' => $supplier->phone,
                    'is_active' => $supplier->is_active,
                ],
            ]);
        }

        return $supplier;
    }
}
