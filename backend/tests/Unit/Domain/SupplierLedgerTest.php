<?php

namespace Tests\Unit\Domain;

use App\Domain\Suppliers\Enums\SupplierTransactionDirection;
use App\Domain\Suppliers\Enums\SupplierTransactionType;
use App\Domain\Support\Money;
use App\Models\Supplier;
use App\Models\SupplierTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SupplierLedgerTest extends TestCase
{
    use RefreshDatabase;

    public function test_supplier_payable_is_correctly_derived_from_ledger_movements(): void
    {
        $user = User::factory()->create();
        $supplier = Supplier::create([
            'name' => 'مصنع دمياط للمصنوعات الخشبية',
            'phone' => '01122334455',
            'is_active' => true,
        ]);

        // Initial payable is 0.00
        $this->assertTrue($supplier->calculatePayable()->equals(Money::zero()));

        // 1. Manual Balance increase (Credit): increases payable
        SupplierTransaction::create([
            'supplier_id' => $supplier->id,
            'type' => SupplierTransactionType::MANUAL_BALANCE_INCREASE,
            'direction' => SupplierTransactionDirection::CREDIT,
            'amount' => Money::from(25000),
            'description' => 'فاتورة شراء 20 قطعة لحاف وأنتريه',
            'created_by' => $user->id,
        ]);

        $this->assertTrue($supplier->calculatePayable()->equals(Money::from(25000)));

        // 2. Pay supplier (Debit): reduces payable
        SupplierTransaction::create([
            'supplier_id' => $supplier->id,
            'type' => SupplierTransactionType::PAYMENT,
            'direction' => SupplierTransactionDirection::DEBIT,
            'amount' => Money::from(15000),
            'description' => 'سداد نقدي للمورد',
            'created_by' => $user->id,
        ]);

        $this->assertTrue($supplier->calculatePayable()->equals(Money::from(10000)));

        // 3. Stock receipt purchase (Credit): increases payable
        SupplierTransaction::create([
            'supplier_id' => $supplier->id,
            'type' => SupplierTransactionType::STOCK_RECEIPT,
            'direction' => SupplierTransactionDirection::CREDIT,
            'amount' => Money::from(8000),
            'description' => 'استلام بضاعة إذن توريد SR-001',
            'created_by' => $user->id,
        ]);

        $this->assertTrue($supplier->calculatePayable()->equals(Money::from(18000)));

        // 4. Complete settlement payment (Debit): payable becomes 0.00
        SupplierTransaction::create([
            'supplier_id' => $supplier->id,
            'type' => SupplierTransactionType::PAYMENT,
            'direction' => SupplierTransactionDirection::DEBIT,
            'amount' => Money::from(18000),
            'description' => 'سداد المتبقي بالكامل تحويل بنكي',
            'created_by' => $user->id,
        ]);

        $this->assertTrue($supplier->calculatePayable()->equals(Money::zero()));
    }

    public function test_supplier_ledger_entries_preserve_audit_traceability(): void
    {
        $user = User::factory()->create();
        $supplier = Supplier::create([
            'name' => 'ورشة الأمانة',
            'phone' => '01555555555',
            'is_active' => true,
        ]);

        $transaction = SupplierTransaction::create([
            'supplier_id' => $supplier->id,
            'type' => SupplierTransactionType::PAYMENT,
            'direction' => SupplierTransactionDirection::DEBIT,
            'amount' => Money::from(3000),
            'description' => 'سداد دفعة للمورد',
            'created_by' => $user->id,
        ]);

        $this->assertSame($supplier->id, $transaction->supplier->id);
        $this->assertSame($user->id, $transaction->creator->id);
        $this->assertSame(SupplierTransactionType::PAYMENT, $transaction->type);
        $this->assertSame(SupplierTransactionDirection::DEBIT, $transaction->direction);
    }
}
