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
        Schema::create('stock_receipts', function (Blueprint $table) {
            $table->id();
            $table->string('receipt_number', 50)->unique()->index();
            $table->string('idempotency_key', 64)->nullable()->unique()->index();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->restrictOnDelete()->comment('Nullable if receiving without registered supplier');
            $table->date('received_date')->index();
            $table->decimal('total_cost', 15, 2);
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
        Schema::dropIfExists('stock_receipts');
    }
};
