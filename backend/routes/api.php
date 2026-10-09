<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Catalog\BarcodePrintController;
use App\Http\Controllers\Api\V1\Catalog\CategoryController;
use App\Http\Controllers\Api\V1\Catalog\ProductController;
use App\Http\Controllers\Api\V1\Customers\CustomerController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\Inventory\InventoryController;
use App\Http\Controllers\Api\V1\Payments\PaymentMethodController;
use App\Http\Controllers\Api\V1\Purchasing\StockReceiptController;
use App\Http\Controllers\Api\V1\Reports\ReportController;
use App\Http\Controllers\Api\V1\Returns\SalesReturnController;
use App\Http\Controllers\Api\V1\Sales\InvoiceController;
use App\Http\Controllers\Api\V1\Suppliers\SupplierController;
use App\Http\Controllers\Api\V1\System\SystemCheckController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — Al-Alamiya ERP/POS
|--------------------------------------------------------------------------
|
| All endpoints reside strictly under the versioned prefix /api/v1
| as required by AGENTS.md Constitution & Phase 1 Specifications.
|
*/

Route::prefix('v1')->group(function () {
    // Health & System Information
    Route::get('/health', [HealthController::class, 'check'])->name('api.v1.health');

    // Authentication Endpoints
    Route::prefix('auth')->group(function () {
        Route::post('/login', [AuthController::class, 'login'])
            ->middleware('throttle:login')
            ->name('api.v1.auth.login');

        // Authenticated Session Endpoints
        Route::middleware('auth:sanctum')->group(function () {
            Route::post('/logout', [AuthController::class, 'logout'])->name('api.v1.auth.logout');
            Route::get('/me', [AuthController::class, 'me'])->name('api.v1.auth.me');
        });
    });

    // Authorization & System Foundation Verification Endpoints
    Route::middleware('auth:sanctum')->prefix('system')->group(function () {
        Route::get('/owner-check', [SystemCheckController::class, 'ownerOnly'])
            ->middleware('role:owner')
            ->name('api.v1.system.owner-check');

        Route::get('/cashier-check', [SystemCheckController::class, 'cashierAllowed'])
            ->middleware('role:owner,cashier')
            ->name('api.v1.system.cashier-check');
    });

    // Phase 3 — Master Data & Operational Endpoints (Owner & Cashier)
    Route::middleware(['auth:sanctum', 'role:owner,cashier'])->group(function () {
        // Categories
        Route::get('/categories', [CategoryController::class, 'index'])->name('api.v1.categories.index');
        Route::post('/categories', [CategoryController::class, 'store'])->name('api.v1.categories.store');
        Route::get('/categories/{category}', [CategoryController::class, 'show'])->name('api.v1.categories.show');
        Route::put('/categories/{category}', [CategoryController::class, 'update'])->name('api.v1.categories.update');
        Route::patch('/categories/{category}/status', [CategoryController::class, 'toggleStatus'])->name('api.v1.categories.toggle-status');

        // Products
        Route::get('/products', [ProductController::class, 'index'])->name('api.v1.products.index');
        Route::get('/products/barcode/{barcode}', [ProductController::class, 'getByBarcode'])->name('api.v1.products.barcode');
        Route::post('/products/barcodes/print-preview', [BarcodePrintController::class, 'preview'])->name('api.v1.products.barcodes.print-preview');
        Route::post('/products', [ProductController::class, 'store'])->name('api.v1.products.store');
        Route::get('/products/{product}', [ProductController::class, 'show'])->name('api.v1.products.show');
        Route::put('/products/{product}', [ProductController::class, 'update'])->name('api.v1.products.update');
        Route::patch('/products/{product}/status', [ProductController::class, 'toggleStatus'])->name('api.v1.products.toggle-status');

        // Payment Methods
        Route::get('/payment-methods', [PaymentMethodController::class, 'index'])->name('api.v1.payment-methods.index');

        // Customers
        Route::get('/customers', [CustomerController::class, 'index'])->name('api.v1.customers.index');
        Route::post('/customers', [CustomerController::class, 'store'])->name('api.v1.customers.store');
        Route::get('/customers/{customer}', [CustomerController::class, 'show'])->name('api.v1.customers.show');
        Route::put('/customers/{customer}', [CustomerController::class, 'update'])->name('api.v1.customers.update');
        Route::patch('/customers/{customer}/status', [CustomerController::class, 'toggleStatus'])->name('api.v1.customers.toggle-status');

        // Suppliers
        Route::get('/suppliers', [SupplierController::class, 'index'])->name('api.v1.suppliers.index');
        Route::post('/suppliers', [SupplierController::class, 'store'])->name('api.v1.suppliers.store');
        Route::get('/suppliers/{supplier}', [SupplierController::class, 'show'])->name('api.v1.suppliers.show');
        Route::put('/suppliers/{supplier}', [SupplierController::class, 'update'])->name('api.v1.suppliers.update');
        Route::patch('/suppliers/{supplier}/status', [SupplierController::class, 'toggleStatus'])->name('api.v1.suppliers.toggle-status');
        Route::post('/suppliers/{supplier}/add-balance', [SupplierController::class, 'addBalance'])->name('api.v1.suppliers.add-balance');

        // Purchasing & Stock Receiving
        Route::get('/stock-receipts', [StockReceiptController::class, 'index'])->name('api.v1.stock-receipts.index');
        Route::post('/stock-receipts', [StockReceiptController::class, 'store'])->name('api.v1.stock-receipts.store');
        Route::get('/stock-receipts/{stockReceipt}', [StockReceiptController::class, 'show'])->name('api.v1.stock-receipts.show');

        // Invoices & POS Sales
        Route::get('/invoices', [InvoiceController::class, 'index'])->name('api.v1.invoices.index');
        Route::post('/invoices', [InvoiceController::class, 'store'])->name('api.v1.invoices.store');
        Route::get('/invoices/{invoice}', [InvoiceController::class, 'show'])->name('api.v1.invoices.show');
        Route::get('/invoices/{invoice}/print', [InvoiceController::class, 'print'])->name('api.v1.invoices.print');

        // Sales Returns & Exchanges (Phase 5)
        Route::get('/returns/search-invoice', [SalesReturnController::class, 'searchInvoice'])->name('api.v1.returns.search-invoice');
        Route::get('/returns/invoice/{invoice}', [SalesReturnController::class, 'getReturnableInvoice'])->name('api.v1.returns.invoice');
        Route::get('/returns', [SalesReturnController::class, 'index'])->name('api.v1.returns.index');
        Route::post('/returns', [SalesReturnController::class, 'store'])->name('api.v1.returns.store');
        Route::get('/returns/{salesReturn}', [SalesReturnController::class, 'show'])->name('api.v1.returns.show');

        // Inventory
        Route::get('/inventory', [InventoryController::class, 'index'])->name('api.v1.inventory.index');

        // Reports (Phase 11 - Owner Only)
        Route::middleware(['role:owner'])->prefix('reports')->group(function () {
            Route::get('/overview', [ReportController::class, 'overview'])->name('api.v1.reports.overview');
            Route::get('/sales', [ReportController::class, 'sales'])->name('api.v1.reports.sales');
            Route::get('/profit', [ReportController::class, 'profit'])->name('api.v1.reports.profit');
            Route::get('/expenses', [ReportController::class, 'expenses'])->name('api.v1.reports.expenses');
            Route::get('/customers', [ReportController::class, 'customers'])->name('api.v1.reports.customers');
            Route::get('/customer-balances', [ReportController::class, 'customerBalances'])->name('api.v1.reports.customer-balances');
            Route::get('/suppliers', [ReportController::class, 'suppliers'])->name('api.v1.reports.suppliers');
            Route::get('/supplier-payables', [ReportController::class, 'supplierPayables'])->name('api.v1.reports.supplier-payables');
            Route::get('/inventory', [ReportController::class, 'inventory'])->name('api.v1.reports.inventory');
            Route::get('/inventory-valuation', [ReportController::class, 'inventoryValuation'])->name('api.v1.reports.inventory-valuation');
            Route::get('/payments', [ReportController::class, 'payments'])->name('api.v1.reports.payments');
            Route::get('/payment-movements', [ReportController::class, 'paymentMovements'])->name('api.v1.reports.payment-movements');
            Route::get('/documents', [ReportController::class, 'documents'])->name('api.v1.reports.documents');
            Route::get('/history/invoices', [ReportController::class, 'invoicesHistory'])->name('api.v1.reports.history.invoices');
            Route::get('/history/returns', [ReportController::class, 'returnsHistory'])->name('api.v1.reports.history.returns');
        });
    });
});
