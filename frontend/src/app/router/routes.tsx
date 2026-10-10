import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth, RequireRole } from './Guards';
import { AppLayout } from './AppLayout';
import { LoginPage } from './pages/LoginPage';
import { CategoriesPage } from '../../features/categories/CategoriesPage';
import { ProductsPage } from '../../features/products/ProductsPage';
import { CustomersPage } from '../../features/customers/CustomersPage';
import { SuppliersPage } from '../../features/suppliers/SuppliersPage';
import { StockReceivingPage } from '../../features/stock-receiving/StockReceivingPage';
import { InventoryPage } from '../../features/inventory/InventoryPage';
import { PosPage } from '../../features/pos/PosPage';
import { InvoicesPage } from '../../features/invoices/InvoicesPage';
import { ReturnsPage } from '../../features/returns/ReturnsPage';
import { BarcodePrintingPage } from '../../features/barcodes/BarcodePrintingPage';
import { ReportsPage } from '../../features/reports/ReportsPage';
import { SettingsPage } from '../../features/settings/SettingsPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected ERP Shell Routes */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        {/* Default route lands directly on POS (Primary Showroom Operation) */}
        <Route index element={<Navigate to="/pos" replace />} />

        {/* Operational Workflow Routes (Owner & Cashier) */}
        <Route path="pos" element={<PosPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="returns" element={<ReturnsPage />} />

        <Route path="products" element={<ProductsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="stock-receiving" element={<StockReceivingPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="barcodes" element={<BarcodePrintingPage />} />

        <Route path="customers" element={<CustomersPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />

        {/* Expenses: Blocked until Phase 17 per Owner Decision */}
        <Route path="expenses" element={<Navigate to="/pos" replace />} />

        {/* System Check: Redirect to Owner Settings */}
        <Route path="system-check" element={<Navigate to="/settings" replace />} />

        {/* Reports Section (Subject to server-side password gate for Cashier) */}
        <Route
          path="reports"
          element={
            <RequireRole roles={['owner', 'cashier']}>
              <ReportsPage />
            </RequireRole>
          }
        />

        {/* Owner Settings Section */}
        <Route
          path="settings"
          element={
            <RequireRole roles={['owner']}>
              <SettingsPage />
            </RequireRole>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
};
