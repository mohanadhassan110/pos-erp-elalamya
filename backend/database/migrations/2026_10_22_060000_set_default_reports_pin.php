<?php

use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Setting::get('reports_password_hash')) {
            Setting::set('reports_password_hash', Hash::make('1234'), 'string', 'security');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Keep settings intact on rollback to avoid losing configured security pin
    }
};
