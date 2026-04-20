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
    children?: AppMenuItem[];
    type?: 'group' | 'divider';
    permissions?: string[];
    roles?: string[];
}

/**
 * Configuración del menú principal de navegación
 * Basado en los módulos del ERP MastERP
 */
export const menuItems: AppMenuItem[] = [
    {
        key: '/app',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
    },
    {
        key: '/app/inventory',
        icon: <ShopOutlined />,
        label: 'Inventario',
        children: [
            {
                key: '/app/inventory/products',
                label: 'Productos Terminados',
            },
            {
                key: '/app/inventory/composites',
                label: 'Productos Compuestos',
            },
            {
                key: '/app/inventory/currencies',
                label: 'Monedas',
            },
            {
                key: '/app/inventory/departments',
                label: 'Departamentos',
            },
            {
                key: '/app/inventory/units',
                label: 'Unidades',
            },
            {
                key: '/app/inventory/adjustments',
                label: 'Ajustes de Inventario',
            },
            {
                key: '/app/inventory/services',
                label: 'Servicios',
            },
        ],
    },
    {
        key: '/app/sales',
        icon: <DollarOutlined />,
        label: 'Ventas',
        children: [
            {
                key: '/app/sales/pos',
                label: 'Punto de Venta',
            },
            {
                key: '/app/sales/history',
                label: 'Historial de Ventas',
            },
            {
                key: '/app/sales/returns',
                label: 'Cambios y Devoluciones',
            },
            {
                key: '/app/accounts-receivable',
                label: 'Cuentas por Cobrar',
            },
            {
                key: '/app/sales/cash-register',
                label: 'Caja',
            },
            {
                key: '/app/sales/retentions',
                label: 'Retenciones Fiscales',
            },
            {
                key: '/app/clients',
                label: 'Clientes',
            },
        ],
    },
    {
        key: '/app/marketing',
        icon: <NotificationOutlined />,
        label: 'MarketingP',
        children: [
            {
                key: '/app/marketing/dashboard',
                label: 'Centro de Control',
            },
            {
                key: '/app/marketing/social',
                label: 'Social Hub (IA)',
            },
            {
                key: '/app/marketing/campaigns',
                label: 'Campañas Masivas',
            },
            {
                key: '/app/marketing/templates',
                label: 'Plantillas de Mensajes',
            },
            {
                key: '/app/marketing/coupons',
                label: 'Cupones de Descuento',
            },
            {
                key: '/app/marketing/settings',
                label: 'Configuración',
            },
        ],
    },
    {
        key: '/app/purchases',
        icon: <ShoppingOutlined />,
        label: 'Compras',
        children: [
            {
                key: '/app/suppliers',
                label: 'Proveedores',
            },
            {
                key: '/app/purchases/orders',
                label: 'Pedidos',
            },
            {
                key: '/app/purchases/history',
                label: 'Historial de Compras',
            },
            {
                key: '/app/accounts-payable',
                icon: <CreditCardOutlined />,
                label: 'Cuentas por Pagar',
            },
        ],
    },
    {
        key: '/app/expenses',
        icon: <DollarOutlined />,
        label: 'Gastos',
    },
    {
        key: '/app/hr',
        icon: <TeamOutlined />,
        label: 'Nómina',
        children: [
            {
                key: '/app/hr/employees',
                label: 'Empleados',
            },
            {
                key: '/app/hr/payroll',
                label: 'Periodos de Nómina',
            },
        ]
    },
    {
        key: '/app/banks',
        icon: <BankOutlined />,
        label: 'Bancos',
    },
    {
        key: '/app/reports',
        icon: <BarChartOutlined />,
        label: 'Reportes',
    },
    {
        key: '/app/mercadolibre',
        icon: <ShopOutlined />,
        label: 'Mercado Libre',
    },
    {
        type: 'group',
        label: '──────────────────',
        children: [],
        roles: ['ADMIN'], // Only admin sees the divider group for config
    },
    {
        key: '/app/configuration',
        icon: <SettingOutlined />,
        label: 'Configuración',
        roles: ['ADMIN'], // Only admin sees configuration
        children: [
            {
                key: '/app/configuration/company',
                label: 'Datos de Empresa',
            },
            {
                key: '/app/configuration/ai',
                label: 'Inteligencia Artificial',
                roles: ['ADMIN'],
            },
            {
                key: '/app/configuration/dev-tools',
                label: 'Opciones de Desarrollador',
            },
            {
                key: '/app/configuration/general',
                label: 'Opciones Generales',
            },
            {
                key: '/app/configuration/network',
                label: 'Conexión de Red (LAN)',
            },
            {
                key: '/app/configuration/users',
                label: 'Gestión de Usuarios',
                roles: ['ADMIN'],
            },
        ],
    },
];
