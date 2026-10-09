<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sales_returns', function (Blueprint $table) {
            $table->id();
            $table->string('return_number', 50)->unique()->index();
            $table->foreignId('invoice_id')->constrained('invoices')->restrictOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->restrictOnDelete();
            $table->string('resolution', 40)->index()->comment('refund_cash, exchange_equal, exchange_upgrade, customer_account_credit');
            $table->decimal('total_return_amount', 15, 2);
            $table->foreignId('replacement_invoice_id')->nullable()->constrained('invoices')->nullOnDelete()->comment('Linked replacement invoice in exchange transactions');
            $table->decimal('difference_amount', 15, 2)->default(0.00)->comment('Difference collected or refunded/credited in exchange');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sales_returns');
    }
};
