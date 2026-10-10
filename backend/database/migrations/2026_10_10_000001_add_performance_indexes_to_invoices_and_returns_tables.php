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
        Schema::table('invoices', function (Blueprint $table) {
            $table->index('created_at', 'invoices_created_at_index');
            $table->index(['customer_id', 'created_at'], 'invoices_customer_id_created_at_index');
        });

        Schema::table('sales_returns', function (Blueprint $table) {
            $table->index('created_at', 'sales_returns_created_at_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales_returns', function (Blueprint $table) {
            $table->dropIndex('sales_returns_created_at_index');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex('invoices_customer_id_created_at_index');
            $table->dropIndex('invoices_created_at_index');
        });
    }
};
