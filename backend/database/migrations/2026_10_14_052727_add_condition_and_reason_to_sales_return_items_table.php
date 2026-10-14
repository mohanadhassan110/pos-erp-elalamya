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
        Schema::table('sales_return_items', function (Blueprint $table) {
            $table->string('item_condition', 20)->default('resellable')->after('quantity');
            $table->string('return_reason')->nullable()->after('item_condition');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales_return_items', function (Blueprint $table) {
            $table->dropColumn(['item_condition', 'return_reason']);
        });
    }
};
