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
        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->restrictOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->restrictOnDelete()->comment('Null for external products');
            $table->string('item_type', 20)->default('product')->index()->comment('product, external');
            $table->string('product_name');
            $table->string('barcode', 20)->nullable();
            $table->integer('quantity');
            $table->decimal('unit_sale_price', 15, 2)->comment('Actual sale price snapshot');
            $table->decimal('unit_cost', 15, 2)->comment('Purchase cost snapshot at time of sale; NEVER recalculated');
            $table->decimal('subtotal', 15, 2)->comment('quantity * unit_sale_price');
            $table->decimal('total_cost', 15, 2)->comment('quantity * unit_cost');
            $table->decimal('profit', 15, 2)->comment('subtotal - total_cost; frozen historical profit');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoice_items');
    }
};
