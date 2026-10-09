import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth, RequireRole } from './Guards';
import { AppLayout } from './AppLayout';
import { LoginPage } from './pages/LoginPage';
import { SystemFoundationPage } from './pages/SystemFoundationPage';
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
import {
  ExpensesPlaceholderPage,
  SettingsPlaceholderPage,
} from './pages/Placeholders';

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
        <Route index element={<Navigate to="/system-check" replace />} />
        <Route path="system-check" element={<SystemFoundationPage />} />

        {/* Operational Workflow Routes (Owner & Cashier) */}
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="stock-receiving" element={<StockReceivingPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="pos" element={<PosPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="barcodes" element={<BarcodePrintingPage />} />
        <Route path="expenses" element={<ExpensesPlaceholderPage />} />

        {/* Owner-Only Restricted Routes */}
        <Route
          path="reports"
          element={
            <RequireRole roles={['owner']}>
              <ReportsPage />
            </RequireRole>
          }
        />
        <Route
          path="settings"
          element={
            <RequireRole roles={['owner']}>
              <SettingsPlaceholderPage />
            </RequireRole>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/system-check" replace />} />
    </Routes>
  );
};
