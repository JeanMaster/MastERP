import { useState, useRef } from 'react';
import { Card, Tabs, Grid, Select } from 'antd';
import { InventoryReports } from './components/InventoryReports';
import { FinancialReports } from './components/FinancialReports';
import { BalanceReports } from './components/BalanceReports';
import { TopProductsReport } from './components/TopProductsReport';
import COGSReport from './components/COGSReport';
import InflationReport from './components/InflationReport';
import WeeklyPerformanceReport from './components/WeeklyPerformanceReport';
import MonthlyDailyPerformanceReport from './components/MonthlyDailyPerformanceReport';
import { ExpenseReports } from './components/ExpenseReports';
import { HourlyPerformanceReport } from './components/HourlyPerformanceReport';
import { ProductsReport } from './components/ProductsReport';
import { PurchasesReport } from './components/PurchasesReport';
import { TaxReports } from './components/TaxReports';
import { FiscalBooks } from './components/FiscalBooks';

const { useBreakpoint } = Grid;

export const ReportsPage = () => {
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [activeTab, setActiveTab] = useState('inventory');
    const [selectOpen, setSelectOpen] = useState(false);
    const selectRef = useRef<any>(null);

    const tabItems = [
        { key: 'inventory', label: '📦 Inventario' },
        { key: 'financial', label: '💰 Financiero' },
        { key: 'tax', label: '🧾 Impuestos / IVA' },
        { key: 'expenses', label: '💳 Gastos' },
        { key: 'balance', label: '📊 Balance General' },
        { key: 'top-products', label: '⭐ Más Vendidos' },
        { key: 'products', label: '📋 Producto' },
        { key: 'purchases', label: '🛒 Compras' },
        { key: 'cogs', label: '🔄 Reposición (COGS)' },
        { key: 'inflation', label: '📈 Impacto Inflacionario' },
        { key: 'weekly-performance', label: '📅 Semanal' },
        { key: 'monthly-daily', label: '🗓️ Mapa Mensual' },
        { key: 'hourly', label: '⏰ Horas Pico' },
        { key: 'fiscal-books', label: '📚 Libros IVA (SENIAT)' },
    ];

    const renderContent = (key: string) => {
        switch (key) {
            case 'inventory': return <InventoryReports />;
            case 'financial': return <FinancialReports />;
            case 'tax': return <TaxReports />;
            case 'expenses': return <ExpenseReports />;
            case 'balance': return <BalanceReports />;
            case 'top-products': return <TopProductsReport />;
            case 'products': return <ProductsReport />;
            case 'purchases': return <PurchasesReport />;
            case 'cogs': return <COGSReport />;
            case 'inflation': return <InflationReport />;
            case 'weekly-performance': return <WeeklyPerformanceReport />;
            case 'monthly-daily': return <MonthlyDailyPerformanceReport />;
            case 'hourly': return <HourlyPerformanceReport currency="VES" />;
            case 'fiscal-books': return <FiscalBooks />;
            default: return <InventoryReports />;
        }
    };

    const items = tabItems.map(item => ({
        ...item,
        children: activeTab === item.key ? renderContent(item.key) : null
    }));

    return (
        <Card
            title={isMobile ? undefined : 'Reportes'}
            style={{ margin: isMobile ? '8px' : '16px', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
            styles={{ body: { padding: isMobile ? 8 : 24 } }}
        >
            {isMobile ? (
                <>
                    <h2 style={{ fontSize: 20, marginBottom: 12, padding: '0 8px' }}>📊 Reportes</h2>
                    <Select
                        ref={selectRef}
                        open={selectOpen}
                        onOpenChange={setSelectOpen}
                        value={activeTab}
                        onChange={(val) => {
                            setActiveTab(val);
                            setSelectOpen(false);
                            selectRef.current?.blur();
                        }}
                        style={{ width: '100%', marginBottom: 16 }}
                        size="large"
                        options={tabItems.map(t => ({ value: t.key, label: t.label }))}
                    />
                    <div style={{ padding: '0 4px' }}>
                        {renderContent(activeTab)}
                    </div>
                </>
            ) : (
                <>
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={items}
                        size="large"
                        tabBarStyle={{ marginBottom: 0 }}
                        destroyInactiveTabPane={true}
                        className="reports-tabs"
                    />
                    <style>{`
                        .reports-tabs .ant-tabs-nav-wrap {
                            white-space: normal !important;
                            flex-wrap: wrap !important;
                        }
                        .reports-tabs .ant-tabs-nav-list {
                            flex-wrap: wrap !important;
                            width: 100%;
                        }
                        .reports-tabs .ant-tabs-tab {
                            margin-bottom: 8px !important;
                        }
                    `}</style>
                </>
            )}
        </Card>
    );
};