<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Auth\Enums\UserRole;
use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Customers\Enums\CustomerTransactionType;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerTransaction;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MasterDataTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->cashier = User::factory()->create([
            'role' => UserRole::CASHIER,
            'is_active' => true,
        ]);

        $this->owner = User::factory()->create([
            'role' => UserRole::OWNER,
            'is_active' => true,
        ]);
    }

    public function test_cashier_can_create_category_with_valid_letter(): void
    {
        Sanctum::actingAs($this->cashier);

        $response = $this->postJson('/api/v1/categories', [
            'name' => 'غرف سفرة',
            'code' => 'd', // lower case input
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.name', 'غرف سفرة')
            ->assertJsonPath('data.code', 'D'); // normalized to uppercase

        $this->assertDatabaseHas('categories', [
            'name' => 'غرف سفرة',
            'code' => 'D',
            'is_active' => true,
        ]);
    }

    public function test_duplicate_category_code_is_rejected(): void
    {
        Sanctum::actingAs($this->cashier);

        Category::create(['name' => 'فئة 1', 'code' => 'K', 'is_active' => true]);

        $response = $this->postJson('/api/v1/categories', [
            'name' => 'فئة 2',
            'code' => 'k',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    public function test_invalid_category_code_is_rejected(): void
    {
        Sanctum::actingAs($this->cashier);

        $response = $this->postJson('/api/v1/categories', [
            'name' => 'فئة غير صالحة',
            'code' => '12',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    public function test_category_code_cannot_be_changed_if_products_exist(): void
    {
        Sanctum::actingAs($this->cashier);

        $category = Category::create(['name' => 'مطابخ', 'code' => 'M', 'is_active' => true]);
        Product::create([
            'category_id' => $category->id,
            'name' => 'مطبخ خشب زان',
            'barcode' => 'M0001',
            'purchase_cost' => Money::from(10000),
            'wholesale_price' => Money::from(12000),
            'retail_price' => Money::from(14000),
            'stock_quantity' => Quantity::from(1),
            'is_active' => true,
        ]);

        $response = $this->putJson("/api/v1/categories/{$category->id}", [
            'name' => 'مطابخ خشبية',
            'code' => 'K',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    public function test_can_toggle_category_status(): void
    {
        Sanctum::actingAs($this->cashier);

        $category = Category::create(['name' => 'تحف', 'code' => 'V', 'is_active' => true]);

        $response = $this->patchJson("/api/v1/categories/{$category->id}/status", [
            'is_active' => false,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('categories', ['id' => $category->id, 'is_active' => false]);
    }

    public function test_cashier_can_create_product_with_initial_stock_movement(): void
    {
        Sanctum::actingAs($this->cashier);

        $category = Category::create(['name' => 'أطقم صالون', 'code' => 'S', 'is_active' => true]);

        $response = $this->postJson('/api/v1/products', [
            'category_id' => $category->id,
            'name' => 'صالون كلاسيك فاخر',
            'purchase_cost' => '12000.00',
            'wholesale_price' => '14500.00',
            'retail_price' => '17000.00',
            'initial_stock' => 3,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.barcode', 'S0001')
            ->assertJsonPath('data.stock_quantity', 3);

        $product = Product::where('barcode', 'S0001')->firstOrFail();

        // Verify inventory movement created for initial stock
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'stock_receipt',
            'quantity' => 3,
            'resulting_stock' => 3,
        ]);
    }

    public function test_product_price_and_cost_editing_updates_current_cost_cleanly(): void
    {
        Sanctum::actingAs($this->cashier);

        $category = Category::create(['name' => 'كراسي', 'code' => 'C', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'كرسي فوتيه',
            'barcode' => 'C0001',
            'purchase_cost' => Money::from(800),
            'wholesale_price' => Money::from(1000),
            'retail_price' => Money::from(1200),
            'stock_quantity' => Quantity::from(5),
            'is_active' => true,
        ]);

        $response = $this->putJson("/api/v1/products/{$product->id}", [
            'purchase_cost' => '950.00',
            'wholesale_price' => '1150.00',
            'retail_price' => '1350.00',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.purchase_cost', '950.00')
            ->assertJsonPath('data.barcode', 'C0001'); // barcode unchanged!

        $product->refresh();
        $this->assertTrue($product->purchase_cost->equals(Money::from(950)));
    }

    public function test_customer_crud_and_balance_reporting(): void
    {
        Sanctum::actingAs($this->cashier);

        // 1. Create Customer
        $res = $this->postJson('/api/v1/customers', [
            'name' => 'معرض الفردوس بالجيزة',
            'phone' => '01011122233',
            'address' => 'شارع الهرم، الجيزة',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.name', 'معرض الفردوس بالجيزة')
            ->assertJsonPath('data.balance', '0.00')
            ->assertJsonPath('data.balance_status', 'settled');

        $customer = Customer::where('phone', '01011122233')->firstOrFail();

        // 2. Add wholesale invoice debt to ledger
        CustomerTransaction::create([
            'customer_id' => $customer->id,
            'type' => CustomerTransactionType::INVOICE,
            'direction' => CustomerTransactionDirection::DEBIT,
            'amount' => Money::from(8500),
            'description' => 'فاتورة بيع جملة',
        ]);

        // 3. Query customer again -> balance reflects debt
        $showRes = $this->getJson("/api/v1/customers/{$customer->id}");
        $showRes->assertStatus(200)
            ->assertJsonPath('data.balance', '8500.00')
            ->assertJsonPath('data.balance_status', 'debt');
    }

    public function test_supplier_crud_payable_and_add_balance(): void
    {
        Sanctum::actingAs($this->cashier);

        // 1. Create Supplier
        $res = $this->postJson('/api/v1/suppliers', [
            'name' => 'مصنع النور للأبواب والشبابيك',
            'phone' => '01222233344',
            'address' => 'دمياط الجديدة',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.name', 'مصنع النور للأبواب والشبابيك')
            ->assertJsonPath('data.payable', '0.00');

        $supplier = Supplier::where('phone', '01222233344')->firstOrFail();

        // 2. Add Supplier Balance operation (increases payable, no inventory mutation)
        $addRes = $this->postJson("/api/v1/suppliers/{$supplier->id}/add-balance", [
            'amount' => '15000.00',
            'description' => 'فاتورة شراء 20 قطعة خشب زان مجفف',
        ]);

        $addRes->assertStatus(201)
            ->assertJsonPath('supplier.payable', '15000.00');

        $supplier->refresh();
        $this->assertTrue($supplier->calculatePayable()->equals(Money::from(15000)));

        // Verify zero inventory movements created for this account-only operation
        $this->assertDatabaseMissing('inventory_movements', [
            'reason' => 'فاتورة شراء 20 قطعة خشب زان مجفف',
        ]);
    }
}
