<?php

namespace App\Actions\Suppliers;

use App\Models\AuditLog;
use App\Models\Supplier;
use App\Models\User;

class ToggleSupplierStatusAction
{
    public function execute(Supplier $supplier, ?bool $status = null, ?User $actor = null): Supplier
    {
        $oldStatus = $supplier->is_active;
        $newStatus = $status ?? ! $oldStatus;

        $supplier->is_active = $newStatus;
        $supplier->save();

        if ($actor) {
            AuditLog::create([
                'user_id' => $actor->id,
                'action' => $newStatus ? 'supplier_activated' : 'supplier_deactivated',
                'auditable_type' => Supplier::class,
                'auditable_id' => $supplier->id,
                'old_values' => ['is_active' => $oldStatus],
                'new_values' => ['is_active' => $newStatus],
            ]);
        }

        return $supplier;
    }
}
