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
        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->string('type', 30)->index()->comment('stock_receipt, sale, sale_cancellation, sales_return, adjustment');
            $table->integer('quantity')->comment('Quantity changed in this movement');
            $table->decimal('unit_cost', 15, 2)->nullable()->comment('Historical unit cost at time of movement');
            $table->integer('resulting_stock')->comment('Stock quantity after this movement');
            $table->nullableMorphs('reference'); // Reference to Invoice, StockReceipt, SalesReturn, etc.
            $table->string('reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_movements');
    }
};
