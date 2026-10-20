<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Customers\Enums\CustomerTransactionType;
use App\Domain\Payments\Enums\PaymentType;
use App\Domain\Suppliers\Enums\SupplierTransactionDirection;
use App\Domain\Suppliers\Enums\SupplierTransactionType;
use App\Domain\Support\Money;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\CustomerTransaction;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Supplier;
use App\Models\SupplierTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerSupplierPaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $cashier;

    private PaymentMethod $cashMethod;

    private PaymentMethod $bankMethod;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => 'owner',
            'is_active' => true,
        ]);

        $this->cashier = User::factory()->create([
            'role' => 'cashier',
            'is_active' => true,
        ]);

        $this->cashMethod = PaymentMethod::create([
            'name' => 'نقدي',
            'code' => 'cash',
            'is_active' => true,
            'is_cash' => true,
        ]);

        $this->bankMethod = PaymentMethod::create([
            'name' => 'تحويل بنكي',
            'code' => 'bank_transfer',
            'is_active' => true,
            'is_cash' => false,
        ]);
    }

    public function test_can_record_customer_payment_and_reduce_debt(): void
    {
        $customer = Customer::create([
            'name' => 'تاجر الجملة علي',
            'phone' => '01012345678',
            'is_active' => true,
        ]);

        // Give customer initial debt of 500
        CustomerTransaction::create([
            'customer_id' => $customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => Money::fromDecimal('500.00'),
            'description' => 'فاتورة أولية',
        ]);

        $this->assertEquals('500.00', $customer->calculateBalance()->toDecimal());

        // Cashier records customer payment of 200
        $response = $this->actingAs($this->cashier)
            ->postJson("/api/v1/customers/{$customer->id}/payments", [
                'amount' => '200.00',
                'payment_method_id' => $this->cashMethod->id,
                'notes' => 'دفعة نقدية بالمعرض',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('customer.balance', '300.00')
            ->assertJsonPath('customer.balance_status', 'debt');

        // Check Payment table
        $this->assertDatabaseHas('payments', [
            'amount' => '200.00',
            'payment_type' => PaymentType::CUSTOMER_PAYMENT->value,
            'payment_method_id' => $this->cashMethod->id,
            'payable_type' => Customer::class,
            'payable_id' => $customer->id,
        ]);

        // Check CustomerTransaction
        $this->assertDatabaseHas('customer_transactions', [
            'customer_id' => $customer->id,
            'type' => CustomerTransactionType::PAYMENT->value,
            'direction' => CustomerTransactionDirection::CREDIT->value,
            'amount' => '200.00',
        ]);

        // Balance updated
        $this->assertEquals('300.00', $customer->calculateBalance()->toDecimal());

        // AuditLog created
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'customer_payment_created',
            'auditable_type' => Customer::class,
            'auditable_id' => $customer->id,
        ]);
    }

    public function test_customer_payment_validation_fails_on_invalid_data(): void
    {
        $customer = Customer::create([
            'name' => 'عميل معطل',
            'is_active' => false,
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/api/v1/customers/{$customer->id}/payments", [
                'amount' => '100.00',
                'payment_method_id' => $this->cashMethod->id,
            ]);

        $response->assertStatus(422);

        // Active customer with 0 or negative amount
        $activeCustomer = Customer::create([
            'name' => 'عميل نشط',
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/api/v1/customers/{$activeCustomer->id}/payments", [
                'amount' => '0',
                'payment_method_id' => $this->cashMethod->id,
            ]);

        $response->assertStatus(422);
    }

    public function test_can_record_supplier_payment_and_reduce_payable(): void
    {
        $supplier = Supplier::create([
            'name' => 'مصنع المحلة للنسيج',
            'phone' => '01098765432',
            'is_active' => true,
        ]);

        // Initial payable of 1000
        SupplierTransaction::create([
            'supplier_id' => $supplier->id,
            'type' => SupplierTransactionType::MANUAL_BALANCE_INCREASE,
            'direction' => SupplierTransactionDirection::CREDIT,
            'amount' => Money::fromDecimal('1000.00'),
            'description' => 'رصيد مستحق أولي',
        ]);

        $this->assertEquals('1000.00', $supplier->calculatePayable()->toDecimal());

        // Record supplier payment of 400
        $response = $this->actingAs($this->cashier)
            ->postJson("/api/v1/suppliers/{$supplier->id}/payments", [
                'amount' => '400.00',
                'payment_method_id' => $this->bankMethod->id,
                'notes' => 'تحويل بنكي دفعة أولى',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('supplier.payable', '600.00')
            ->assertJsonPath('supplier.is_settled', false);

        // Check Payment table
        $this->assertDatabaseHas('payments', [
            'amount' => '400.00',
            'payment_type' => PaymentType::SUPPLIER_PAYMENT->value,
            'payment_method_id' => $this->bankMethod->id,
            'payable_type' => Supplier::class,
            'payable_id' => $supplier->id,
        ]);

        // Check SupplierTransaction
        $this->assertDatabaseHas('supplier_transactions', [
            'supplier_id' => $supplier->id,
            'type' => SupplierTransactionType::PAYMENT->value,
            'direction' => SupplierTransactionDirection::DEBIT->value,
            'amount' => '400.00',
        ]);

        // Payable updated
        $this->assertEquals('600.00', $supplier->calculatePayable()->toDecimal());

        // AuditLog created
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'supplier_payment_created',
            'auditable_type' => Supplier::class,
            'auditable_id' => $supplier->id,
        ]);
    }

    public function test_supplier_payment_validation_fails_on_invalid_data(): void
    {
        $supplier = Supplier::create([
            'name' => 'مورد معطل',
            'is_active' => false,
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/api/v1/suppliers/{$supplier->id}/payments", [
                'amount' => '100.00',
                'payment_method_id' => $this->cashMethod->id,
            ]);

        $response->assertStatus(422);

        $activeSupplier = Supplier::create([
            'name' => 'مورد نشط',
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/api/v1/suppliers/{$activeSupplier->id}/payments", [
                'amount' => '-50',
                'payment_method_id' => $this->cashMethod->id,
            ]);

        $response->assertStatus(422);
    }

    public function test_can_get_customer_statement_with_running_balance(): void
    {
        $customer = Customer::create([
            'name' => 'شركة النور للمفروشات',
            'phone' => '01011112222',
            'is_active' => true,
        ]);

        // Transaction 1: Invoice debit 1000
        CustomerTransaction::create([
            'customer_id' => $customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => Money::fromDecimal('1000.00'),
            'description' => 'فاتورة مبيعات جملة رقم INV-001',
            'created_at' => now()->subDays(3),
        ]);

        // Transaction 2: Payment credit 400
        CustomerTransaction::create([
            'customer_id' => $customer->id,
            'type' => CustomerTransactionType::PAYMENT,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => Money::fromDecimal('400.00'),
            'description' => 'سداد دفعة على الحساب',
            'created_at' => now()->subDays(2),
        ]);

        // Transaction 3: Return credit 150
        CustomerTransaction::create([
            'customer_id' => $customer->id,
            'type' => CustomerTransactionType::RETURN,
            'direction' => CustomerTransactionDirection::CREDIT,
            'amount' => Money::fromDecimal('150.00'),
            'description' => 'مرتجع مبيعات رقم RET-001',
            'created_at' => now()->subDay(),
        ]);

        $response = $this->actingAs($this->cashier)
            ->getJson("/api/v1/customers/{$customer->id}/statement");

        $response->assertStatus(200)
            ->assertJsonPath('customer.name', 'شركة النور للمفروشات')
            ->assertJsonPath('customer.current_balance', '450.00')
            ->assertJsonPath('period_summary.total_debits', '1000.00')
            ->assertJsonPath('period_summary.total_credits', '550.00')
            ->assertJsonPath('period_summary.closing_balance', '450.00')
            ->assertJsonPath('period_summary.transactions_count', 3)
            ->assertJsonPath('transactions.0.debit', '1000.00')
            ->assertJsonPath('transactions.0.running_balance', '1000.00')
            ->assertJsonPath('transactions.1.credit', '400.00')
            ->assertJsonPath('transactions.1.running_balance', '600.00')
            ->assertJsonPath('transactions.2.credit', '150.00')
            ->assertJsonPath('transactions.2.running_balance', '450.00');

        // Test with ?order=desc (newest to oldest)
        $descResponse = $this->actingAs($this->cashier)
            ->getJson("/api/v1/customers/{$customer->id}/statement?order=desc");

        $descResponse->assertStatus(200)
            ->assertJsonPath('transactions.0.credit', '150.00')
            ->assertJsonPath('transactions.0.running_balance', '450.00')
            ->assertJsonPath('transactions.2.debit', '1000.00')
            ->assertJsonPath('transactions.2.running_balance', '1000.00');
    }

    public function test_can_get_supplier_statement_with_running_balance(): void
    {
        $supplier = Supplier::create([
            'name' => 'مصنع الأهرام للبطاطين',
            'phone' => '01033334444',
            'is_active' => true,
        ]);

        // Transaction 1: Stock receipt credit 5000 (increases payable)
        SupplierTransaction::create([
            'supplier_id' => $supplier->id,
            'type' => SupplierTransactionType::STOCK_RECEIPT,
            'direction' => SupplierTransactionDirection::CREDIT,
            'amount' => Money::fromDecimal('5000.00'),
            'description' => 'استلام بضاعة إذن رقم REC-001',
            'created_at' => now()->subDays(3),
        ]);

        // Transaction 2: Payment debit 2000 (reduces payable)
        SupplierTransaction::create([
            'supplier_id' => $supplier->id,
            'type' => SupplierTransactionType::PAYMENT,
            'direction' => SupplierTransactionDirection::DEBIT,
            'amount' => Money::fromDecimal('2000.00'),
            'description' => 'سداد دفعة للمورد',
            'created_at' => now()->subDays(2),
        ]);

        // Transaction 3: Manual increase credit 1000
        SupplierTransaction::create([
            'supplier_id' => $supplier->id,
            'type' => SupplierTransactionType::MANUAL_BALANCE_INCREASE,
            'direction' => SupplierTransactionDirection::CREDIT,
            'amount' => Money::fromDecimal('1000.00'),
            'description' => 'فاتورة خارجية سابقة',
            'created_at' => now()->subDay(),
        ]);

        $response = $this->actingAs($this->cashier)
            ->getJson("/api/v1/suppliers/{$supplier->id}/statement");

        $response->assertStatus(200)
            ->assertJsonPath('supplier.name', 'مصنع الأهرام للبطاطين')
            ->assertJsonPath('supplier.current_payable', '4000.00')
            ->assertJsonPath('period_summary.total_credits', '6000.00')
            ->assertJsonPath('period_summary.total_debits', '2000.00')
            ->assertJsonPath('period_summary.closing_balance', '4000.00')
            ->assertJsonPath('period_summary.transactions_count', 3)
            ->assertJsonPath('transactions.0.credit', '5000.00')
            ->assertJsonPath('transactions.0.running_balance', '5000.00')
            ->assertJsonPath('transactions.1.debit', '2000.00')
            ->assertJsonPath('transactions.1.running_balance', '3000.00')
            ->assertJsonPath('transactions.2.credit', '1000.00')
            ->assertJsonPath('transactions.2.running_balance', '4000.00');
    }
}
