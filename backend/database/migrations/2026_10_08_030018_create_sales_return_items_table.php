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
        Schema::create('sales_return_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sales_return_id')->constrained('sales_returns')->restrictOnDelete();
            $table->foreignId('invoice_item_id')->constrained('invoice_items')->restrictOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->restrictOnDelete();
            $table->integer('quantity');
            $table->decimal('unit_sale_price', 15, 2);
            $table->decimal('unit_cost', 15, 2)->comment('Cost snapshot from original invoice item');
            $table->decimal('subtotal', 15, 2);
            $table->decimal('profit_reversal', 15, 2)->comment('Exact profit reversed from historical snapshot');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sales_return_items');
    }
};
