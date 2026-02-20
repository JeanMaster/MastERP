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
 * Basado en los módulos del ERP Zenith
 */
export const menuItems: AppMenuItem[] = [
    {
        key: '/',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
    },
    {
        key: '/inventory',
        icon: <ShopOutlined />,
        label: 'Inventario',
        children: [
            {
                key: '/inventory/products',
                label: 'Productos Terminados',
            },
            {
                key: '/inventory/composites',
                label: 'Productos Compuestos',
            },
            {
                key: '/inventory/currencies',
                label: 'Monedas',
            },
            {
                key: '/inventory/departments',
                label: 'Departamentos',
            },
            {
                key: '/inventory/units',
                label: 'Unidades',
            },
            {
                key: '/inventory/adjustments',
                label: 'Ajustes de Inventario',
            },
            {
                key: '/inventory/services',
                label: 'Servicios',
            },
        ],
    },
    {
        key: '/sales',
        icon: <DollarOutlined />,
        label: 'Ventas',
        children: [
            {
                key: '/sales/pos',
                label: 'Punto de Venta',
            },
            {
                key: '/sales/history',
                label: 'Historial de Ventas',
            },
            {
                key: '/sales/returns',
                label: 'Cambios y Devoluciones',
            },
            {
                key: '/accounts-receivable',
                label: 'Cuentas por Cobrar',
            },
            {
                key: '/sales/cash-register',
                label: 'Caja',
            },
            {
                key: '/clients',
                label: 'Clientes',
            },
        ],
    },
    {
        key: '/purchases',
        icon: <ShoppingOutlined />,
        label: 'Compras',
        children: [
            {
                key: '/suppliers',
                label: 'Proveedores',
            },
            {
                key: '/purchases/orders',
                label: 'Pedidos',
            },
            {
                key: '/purchases/history',
                label: 'Historial de Compras',
            },
            {
                key: '/accounts-payable',
                icon: <CreditCardOutlined />,
                label: 'Cuentas por Pagar',
            },
        ],
    },
    {
        key: '/expenses',
        icon: <DollarOutlined />,
        label: 'Gastos',
    },
    {
        key: '/hr',
        icon: <TeamOutlined />,
        label: 'Nómina',
        children: [
            {
                key: '/hr/employees',
                label: 'Empleados',
            },
            {
                key: '/hr/payroll',
                label: 'Periodos de Nómina',
            },
        ]
    },
    {
        key: '/banks',
        icon: <BankOutlined />,
        label: 'Bancos',
    },
    {
        key: '/reports',
        icon: <BarChartOutlined />,
        label: 'Reportes',
    },
    {
        key: '/mercadolibre',
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
        key: '/configuration',
        icon: <SettingOutlined />,
        label: 'Configuración',
        roles: ['ADMIN'], // Only admin sees configuration
        children: [
            {
                key: '/configuration/company',
                label: 'Datos de Empresa',
            },
            {
                key: '/configuration/dev-tools',
                label: 'Opciones de Desarrollador',
            },
            {
                key: '/configuration/general',
                label: 'Opciones Generales',
            },
            {
                key: '/configuration/network',
                label: 'Conexión de Red (LAN)',
            },
            {
                key: '/configuration/users',
                label: 'Gestión de Usuarios',
                roles: ['ADMIN'],
            },
        ],
    },
];
