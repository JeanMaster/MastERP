import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ModulePage } from './pages/ModulePage';
import { ClientsPage } from './features/clients/ClientsPage';
import { SalesHistoryPage } from './features/sales/SalesHistoryPage';

import { PurchasesPage } from './features/purchases/PurchasesPage';
import { SuppliersPage } from './features/purchases/SuppliersPage';
import { ProductsPage } from './features/products/ProductsPage';
import { CompositeProductsPage } from './features/products/CompositeProductsPage';
import { ServicesPage } from './features/products/ServicesPage';
import { CompanySettingsPage } from './features/company-settings/CompanySettingsPage';
import { GeneralOptionsPage } from './features/company-settings/GeneralOptionsPage';
import { NetworkSettingsPage } from './features/company-settings/NetworkSettingsPage';
import { DepartmentsPage } from './features/departments/DepartmentsPage';
import { UnitsPage } from './features/units/UnitsPage';
import { CurrenciesPage } from './features/currencies/CurrenciesPage';
import { DevToolsPage } from './features/dev-tools/DevToolsPage';
import { POSPage } from './features/pos/POSPage';
import { ReturnsPage } from './features/returns/ReturnsPage';
import { CashRegisterPage } from './features/cash-register/CashRegisterPage';
import { InventoryAdjustmentsPage } from './features/inventory-adjustments/InventoryAdjustmentsPage';
import { AccountsReceivablePage } from './features/accounts-receivable/AccountsReceivablePage';
import { ReportsPage } from './features/reports/ReportsPage';
import { ExpensesPage } from './features/expenses/ExpensesPage';
import { EmployeesPage } from './features/hr/pages/EmployeesPage';
import { PayrollPage } from './features/hr/pages/PayrollPage';
import { PayrollDetailPage } from './features/hr/pages/PayrollDetailPage';
import { AccountsPayablePage } from './features/purchases/AccountsPayablePage';
import { PurchaseOrdersPage } from './features/purchases/PurchaseOrdersPage';
import { BanksPage } from './features/banks/BanksPage'; // Importación
import { UsersPage } from './features/users/UsersPage';
import { RetentionsListPage } from './features/tax-retentions/pages/RetentionsListPage';
import {
  ShoppingCartOutlined,
  ShoppingOutlined,
  TeamOutlined,
  BankOutlined,
  SettingOutlined,
} from '@ant-design/icons';

import { AuthProvider } from './features/auth/AuthProvider';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { PriceCheckerPage } from './features/price-checker/PriceCheckerPage';
import { MercadoLibrePage } from './features/mercadolibre/MercadoLibrePage';
import { LandingPage } from './features/landing/LandingPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/visor" element={<PriceCheckerPage />} />

        <Route path="/app" element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="configuration" element={<ModulePage title="Configuración" icon={<SettingOutlined />} />} />
          <Route path="configuration/company" element={<CompanySettingsPage />} />
          <Route path="configuration/dev-tools" element={<DevToolsPage />} />
          <Route path="configuration/general" element={<GeneralOptionsPage />} />
          <Route path="configuration/network" element={<NetworkSettingsPage />} />
          <Route path="configuration/users" element={<UsersPage />} />

          <Route path="clients" element={<ClientsPage />} />
          <Route path="inventory/products" element={<ProductsPage />} />
          <Route path="inventory/composites" element={<CompositeProductsPage />} />
          <Route path="inventory/adjustments" element={<InventoryAdjustmentsPage />} />
          <Route path="inventory/departments" element={<DepartmentsPage />} />
          <Route path="inventory/units" element={<UnitsPage />} />
          <Route path="inventory/services" element={<ServicesPage />} />
          <Route path="inventory/currencies" element={<CurrenciesPage />} />

          <Route path="sales" element={<ModulePage title="Ventas" icon={<ShoppingCartOutlined />} />} />
          <Route path="sales/pos" element={<POSPage />} />
          <Route path="sales/history" element={<SalesHistoryPage />} />
          <Route path="sales/retentions" element={<RetentionsListPage />} />
          <Route path="sales/returns" element={<ReturnsPage />} />
          <Route path="sales/cash-register" element={<CashRegisterPage />} />

          <Route path="purchases" element={<ModulePage title="Compras" icon={<ShoppingOutlined />} />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="purchases/orders" element={<PurchaseOrdersPage />} />
          <Route path="purchases/history" element={<PurchasesPage />} />
          <Route path="accounts-payable" element={<AccountsPayablePage />} />

          <Route path="expenses" element={<ExpensesPage />} />

          {/* HR Routes */}
          <Route path="hr/employees" element={<EmployeesPage />} />
          <Route path="hr/payroll" element={<PayrollPage />} />
          <Route path="hr/payroll/:id" element={<PayrollDetailPage />} />
          <Route path="banks" element={<BanksPage />} />
          <Route path="accounts-receivable" element={<AccountsReceivablePage />} />
          <Route path="hr" element={<ModulePage title="Nómina" icon={<TeamOutlined />} />} />
          <Route path="banks" element={<ModulePage title="Bancos" icon={<BankOutlined />} />} />
          <Route path="mercadolibre" element={<MercadoLibrePage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
