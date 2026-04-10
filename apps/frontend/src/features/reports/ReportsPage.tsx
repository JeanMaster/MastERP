import { useState } from 'react';
import { Card, Tabs } from 'antd';
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

export const ReportsPage = () => {
    const [activeTab, setActiveTab] = useState('inventory');

    const tabItems = [
        {
            key: 'inventory',
            label: 'Inventario',
            children: <InventoryReports />
        },
        {
            key: 'financial',
            label: 'Financiero',
            children: <FinancialReports />
        },
        {
            key: 'tax',
            label: 'Impuestos / IVA',
            children: <TaxReports />
        },
        {
            key: 'expenses',
            label: 'Gastos',
            children: <ExpenseReports />
        },
        {
            key: 'balance',
            label: 'Balance General',
            children: <BalanceReports />
        },
        {
            key: 'top-products',
            label: 'Productos Más Vendidos',
            children: <TopProductsReport />
        },
        {
            key: 'products',
            label: 'Producto',
            children: <ProductsReport />
        },
        {
            key: 'purchases',
            label: 'Compras',
            children: <PurchasesReport />
        },
        {
            key: 'cogs',
            label: 'Reposición (COGS)',
            children: <COGSReport />
        },
        {
            key: 'inflation',
            label: 'Impacto Inflacionario',
            children: <InflationReport />
        },
        {
            key: 'weekly-performance',
            label: 'Rendimiento Semanal',
            children: <WeeklyPerformanceReport />
        },
        {
            key: 'monthly-daily',
            label: 'Mapa de Ventas (Mensual)',
            children: <MonthlyDailyPerformanceReport />
        },
        {
            key: 'hourly',
            label: 'Horas Pico',
            children: <HourlyPerformanceReport currency="VES" />
        },
        {
            key: 'fiscal-books',
            label: 'Libros de IVA (SENIAT)',
            children: <FiscalBooks />
        }
    ];

    return (
        <Card
            title="Reportes"
            style={{ margin: '16px' }}
        >
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
                size="large"
                // CUSTOM STYLE TO ALLOW WRAPPING INTO TWO LINES
                tabBarStyle={{ marginBottom: 0 }}
                onTabClick={() => { }}
                // This will force the tabs to wrap if there isn't enough space
                // by disabling the "nowrap" flex behavior on the container
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
        </Card>
    );
};