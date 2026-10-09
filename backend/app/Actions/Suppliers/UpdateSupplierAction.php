<?php

namespace App\Actions\Suppliers;

use App\Models\AuditLog;
use App\Models\Supplier;
use App\Models\User;

class UpdateSupplierAction
{
    public function execute(Supplier $supplier, array $data, ?User $actor = null): Supplier
    {
        $oldValues = [
            'name' => $supplier->name,
            'phone' => $supplier->phone,
            'address' => $supplier->address,
            'notes' => $supplier->notes,
            'is_active' => $supplier->is_active,
        ];

        if (isset($data['name'])) {
            $supplier->name = trim($data['name']);
        }
        if (array_key_exists('phone', $data)) {
            $supplier->phone = $data['phone'] ? trim($data['phone']) : null;
        }
        if (array_key_exists('address', $data)) {
            $supplier->address = $data['address'] ? trim($data['address']) : null;
        }
        if (array_key_exists('notes', $data)) {
            $supplier->notes = $data['notes'] ? trim($data['notes']) : null;
        }
        if (isset($data['is_active'])) {
            $supplier->is_active = (bool) $data['is_active'];
        }

        $supplier->save();

        if ($actor) {
            AuditLog::create([
                'user_id' => $actor->id,
                'action' => 'supplier_updated',
                'auditable_type' => Supplier::class,
                'auditable_id' => $supplier->id,
                'old_values' => $oldValues,
                'new_values' => [
                    'name' => $supplier->name,
                    'phone' => $supplier->phone,
                    'address' => $supplier->address,
                    'notes' => $supplier->notes,
                    'is_active' => $supplier->is_active,
                ],
            ]);
        }

        return $supplier;
    }
}
