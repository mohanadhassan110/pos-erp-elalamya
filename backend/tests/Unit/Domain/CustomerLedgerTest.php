<?php

namespace Tests\Unit\Domain;

use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Customers\Enums\CustomerTransactionType;
use App\Domain\Support\Money;
use App\Models\Customer;
use App\Models\CustomerTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerLedgerTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_balance_is_correctly_derived_from_debit_and_credit_ledger_movements(): void
    {
        $user = User::factory()->create();
        $customer = Customer::create([
            'name' => 'معرض الأمل للموبيليا',
            'phone' => '01012345678',
            'is_active' => true,
        ]);

        // Initial balance is 0.00
        $this->assertTrue($customer->calculateBalance()->equals(Money::zero()));

        // 1. Wholesale invoice: Debit 10,000.00 (Customer Debt)
        CustomerTransaction::create([
            'customer_id' => $customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => Money::from(10000),
            'description' => 'فاتورة بيع جملة رقم INV-001',
            'created_by' => $user->id,
        ]);

        $this->assertTrue($customer->calculateBalance()->equals(Money::from(10000)));

        // 2. Customer payment: Credit 6,000.00 (Reduces Debt)
        CustomerTransaction::create([
            'customer_id' => $customer->id,
            'type' => CustomerTransactionType::PAYMENT,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => Money::from(6000),
            'description' => 'سداد نقدي من العميل',
            'created_by' => $user->id,
        ]);

        $this->assertTrue($customer->calculateBalance()->equals(Money::from(4000)));

        // 3. Sales return credited to account: Credit 1,500.00
        CustomerTransaction::create([
            'customer_id' => $customer->id,
            'type' => CustomerTransactionType::RETURN,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => Money::from(1500),
            'description' => 'إضافة مرتجع لحساب العميل',
            'created_by' => $user->id,
        ]);

        $this->assertTrue($customer->calculateBalance()->equals(Money::from(2500)));

        // 4. Overpayment on account: Credit 3,500.00 -> Balance becomes -1,000.00 (Customer Credit)
        CustomerTransaction::create([
            'customer_id' => $customer->id,
            'type' => CustomerTransactionType::PAYMENT,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => Money::from(3500),
            'description' => 'دفعة تحويل بنكي إضافية',
            'created_by' => $user->id,
        ]);

        $this->assertTrue($customer->calculateBalance()->equals(Money::from(-1000)));
    }

    public function test_customer_ledger_entries_preserve_audit_traceability(): void
    {
        $user = User::factory()->create();
        $customer = Customer::create([
            'name' => 'تاجر الجملة الحجاز',
            'phone' => '01234567890',
            'is_active' => true,
        ]);

        $transaction = CustomerTransaction::create([
            'customer_id' => $customer->id,
            'type' => CustomerTransactionType::PAYMENT,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => Money::from(5000),
            'description' => 'سداد دفعة',
            'created_by' => $user->id,
        ]);

        $this->assertSame($customer->id, $transaction->customer->id);
        $this->assertSame($user->id, $transaction->creator->id);
        $this->assertSame(CustomerTransactionType::PAYMENT, $transaction->type);
        $this->assertSame(CustomerTransactionDirection::CREDIT, $transaction->direction);
    }
}
