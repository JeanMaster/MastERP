import {
    DashboardOutlined,
    ShopOutlined,
    ShoppingOutlined,
    DollarOutlined,
    CreditCardOutlined,
    TeamOutlined,
    BankOutlined,
    BarChartOutlined,
    SettingOutlined,
    NotificationOutlined,
} from '@ant-design/icons';

export interface AppMenuItem {
    key?: string;
    icon?: React.ReactNode;
    label: React.ReactNode;
    labelKey?: string; // Key for i18n
    children?: AppMenuItem[];
    type?: 'group' | 'divider';
    permissions?: string[];
    roles?: string[];
}

/**
 * Navigation Menu Configuration
 * Defines the sidebar structure for the MastERP application.
 * Items are categorized by functional modules (Inventory, Sales, HR, etc.) 
 * and support role-based visibility.
 */
export const menuItems: AppMenuItem[] = [
    {
        key: '/app',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
        labelKey: 'menu.dashboard'
    },
    {
        key: '/app/inventory',
        icon: <ShopOutlined />,
        label: 'Inventory',
        labelKey: 'menu.inventory.label',
        children: [
            {
                key: '/app/inventory/products',
                label: 'Finished Products',
                labelKey: 'menu.inventory.finished_products'
            },
            {
                key: '/app/inventory/composites',
                label: 'Bundle Products',
                labelKey: 'menu.inventory.bundle_products'
            },
            {
                key: '/app/inventory/currencies',
                label: 'Currencies & Rates',
                labelKey: 'menu.inventory.currencies'
            },
            {
                key: '/app/inventory/departments',
                label: 'Categories / Departments',
                labelKey: 'menu.inventory.categories'
            },
            {
                key: '/app/inventory/units',
                label: 'Measurement Units',
                labelKey: 'menu.inventory.units'
            },
            {
                key: '/app/inventory/adjustments',
                label: 'Inventory Adjustments',
                labelKey: 'menu.inventory.adjustments'
            },
            {
                key: '/app/inventory/services',
                label: 'Services Catalog',
                labelKey: 'menu.inventory.services'
            },
        ],
    },
    {
        key: '/app/sales',
        icon: <DollarOutlined />,
        label: 'Sales',
        labelKey: 'menu.sales.label',
        children: [
            {
                key: '/app/sales/pos',
                label: 'Point of Sale (POS)',
                labelKey: 'menu.sales.pos'
            },
            {
                key: '/app/sales/history',
                label: 'Sales History',
                labelKey: 'menu.sales.history'
            },
            {
                key: '/app/sales/returns',
                label: 'Exchanges & Returns',
                labelKey: 'menu.sales.returns'
            },
            {
                key: '/app/accounts-receivable',
                label: 'Accounts Receivable',
                labelKey: 'menu.sales.receivable'
            },
            {
                key: '/app/sales/cash-register',
                label: 'Cash Drawer',
                labelKey: 'menu.sales.cash_drawer'
            },
            {
                key: '/app/sales/retentions',
                label: 'Tax Retentions',
                labelKey: 'menu.sales.retentions'
            },
            {
                key: '/app/clients',
                label: 'Customers',
                labelKey: 'menu.sales.customers'
            },
        ],
    },
    {
        key: '/app/marketing',
        icon: <NotificationOutlined />,
        label: 'Marketing Hub',
        labelKey: 'menu.marketing.label',
        children: [
            {
                key: '/app/marketing/dashboard',
                label: 'Control Center',
                labelKey: 'menu.marketing.control_center'
            },
            {
                key: '/app/marketing/social',
                label: 'Social Hub (AI)',
                labelKey: 'menu.marketing.social'
            },
            {
                key: '/app/marketing/campaigns',
                label: 'Bulk Campaigns',
                labelKey: 'menu.marketing.campaigns'
            },
            {
                key: '/app/marketing/templates',
                label: 'Message Templates',
                labelKey: 'menu.marketing.templates'
            },
            {
                key: '/app/marketing/coupons',
                label: 'Discount Coupons',
                labelKey: 'menu.marketing.coupons'
            },
            {
                key: '/app/marketing/settings',
                label: 'Settings',
                labelKey: 'menu.marketing.settings'
            },
        ],
    },
    {
        key: '/app/purchases',
        icon: <ShoppingOutlined />,
        label: 'Purchases',
        labelKey: 'menu.purchases.label',
        children: [
            {
                key: '/app/suppliers',
                label: 'Suppliers',
                labelKey: 'menu.purchases.suppliers'
            },
            {
                key: '/app/purchases/orders',
                label: 'Purchase Orders',
                labelKey: 'menu.purchases.orders'
            },
            {
                key: '/app/purchases/history',
                label: 'Purchase History',
                labelKey: 'menu.purchases.history'
            },
            {
                key: '/app/accounts-payable',
                icon: <CreditCardOutlined />,
                label: 'Accounts Payable',
                labelKey: 'menu.purchases.payable'
            },
        ],
    },
    {
        key: '/app/expenses',
        icon: <DollarOutlined />,
        label: 'Business Expenses',
        labelKey: 'menu.expenses'
    },
    {
        key: '/app/hr',
        icon: <TeamOutlined />,
        label: 'Human Resources',
        labelKey: 'menu.hr.label',
        children: [
            {
                key: '/app/hr/employees',
                label: 'Employee Directory',
                labelKey: 'menu.hr.directory'
            },
            {
                key: '/app/hr/payroll',
                label: 'Payroll Periods',
                labelKey: 'menu.hr.payroll'
            },
        ]
    },
    {
        key: '/app/banks',
        icon: <BankOutlined />,
        label: 'Banking / Cash',
        labelKey: 'menu.banks'
    },
    {
        key: '/app/reports',
        icon: <BarChartOutlined />,
        label: 'Advanced Reports',
        labelKey: 'menu.reports'
    },
    {
        key: '/app/mercadolibre',
        icon: <ShopOutlined />,
        label: 'Mercado Libre Sync',
        labelKey: 'menu.mercadolibre'
    },
    {
        type: 'group',
        label: '──────────────────',
        children: [],
        roles: ['ADMIN'],
    },
    {
        key: '/app/configuration',
        icon: <SettingOutlined />,
        label: 'System Settings',
        labelKey: 'menu.settings.label',
        roles: ['ADMIN'],
        children: [
            {
                key: '/app/configuration/company',
                label: 'Business Profile',
                labelKey: 'menu.settings.business'
            },
            {
                key: '/app/configuration/ai',
                label: 'AI Intelligence Hub',
                labelKey: 'menu.settings.ai',
                roles: ['ADMIN'],
            },
            {
                key: '/app/configuration/dev-tools',
                label: 'Developer Options',
                labelKey: 'menu.settings.dev'
            },
            {
                key: '/app/configuration/general',
                label: 'General Options',
                labelKey: 'menu.settings.general'
            },
            {
                key: '/app/configuration/network',
                label: 'Network & Connectivity (LAN)',
                labelKey: 'menu.settings.network'
            },
            {
                key: '/app/configuration/users',
                label: 'User Management',
                labelKey: 'menu.settings.users',
                roles: ['ADMIN'],
            },
        ],
    },
];
