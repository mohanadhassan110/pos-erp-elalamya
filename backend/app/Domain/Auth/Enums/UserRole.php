<?php

namespace App\Domain\Auth\Enums;

enum UserRole: string
{
    case OWNER = 'owner';
    case CASHIER = 'cashier';

    public function label(): string
    {
        return match ($this) {
            self::OWNER => 'مالك',
            self::CASHIER => 'كاشير',
        };
    }

    public function isOwner(): bool
    {
        return $this === self::OWNER;
    }

    public function isCashier(): bool
    {
        return $this === self::CASHIER;
    }

    public function canAccessReports(): bool
    {
        return $this === self::OWNER;
    }

    public function canAccessSettings(): bool
    {
        return $this === self::OWNER;
    }

    public function canAccessUsers(): bool
    {
        return $this === self::OWNER;
    }

    public function canAccessAuditLogs(): bool
    {
        return $this === self::OWNER;
    }

    public function canPerformSales(): bool
    {
        return true;
    }

    public function canManageCatalog(): bool
    {
        return true;
    }

    public function canManageInventory(): bool
    {
        return true;
    }

    public function canManageCustomers(): bool
    {
        return true;
    }

    public function canManageSuppliers(): bool
    {
        return true;
    }

    public function canManageExpenses(): bool
    {
        return true;
    }

    /**
     * @return array<string, bool>
     */
    public function capabilities(): array
    {
        return [
            'reports_view' => $this->canAccessReports(),
            'settings_manage' => $this->canAccessSettings(),
            'users_manage' => $this->canAccessUsers(),
            'audit_view' => $this->canAccessAuditLogs(),
            'pos_operate' => $this->canPerformSales(),
            'catalog_manage' => $this->canManageCatalog(),
            'inventory_manage' => $this->canManageInventory(),
            'customers_manage' => $this->canManageCustomers(),
            'suppliers_manage' => $this->canManageSuppliers(),
            'expenses_manage' => $this->canManageExpenses(),
        ];
    }
}
