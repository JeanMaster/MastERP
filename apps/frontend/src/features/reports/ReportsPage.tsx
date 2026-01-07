import { useState } from 'react';
import { Card, Tabs } from 'antd';
import { InventoryReports } from './components/InventoryReports';
import { FinancialReports } from './components/FinancialReports';
import { BalanceReports } from './components/BalanceReports';
import { TopProductsReport } from './components/TopProductsReport';
import COGSReport from './components/COGSReport';

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
            key: 'cogs',
            label: 'Reposición (COGS)',
            children: <COGSReport />
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
            />
        </Card>
    );
};