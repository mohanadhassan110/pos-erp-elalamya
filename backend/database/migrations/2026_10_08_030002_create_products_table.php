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
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('categories')->restrictOnDelete();
            $table->string('name')->index();
            $table->string('barcode', 20)->unique()->index();
            $table->decimal('purchase_cost', 15, 2)->comment('Current/latest purchase cost');
            $table->decimal('wholesale_price', 15, 2);
            $table->decimal('retail_price', 15, 2);
            $table->integer('stock_quantity')->default(0)->comment('Cached stock balance; movements are authoritative');
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
