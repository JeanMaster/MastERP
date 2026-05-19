import { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Avatar, Space, Button, Dropdown, Drawer, Grid, Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import {
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    UserOutlined,
    BellOutlined,
    LogoutOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { menuItems } from '../../config/menu';
import type { AppMenuItem } from '../../config/menu';
import { companySettingsApi } from '../../services/companySettingsApi';
import { useAuth } from '../../features/auth/AuthProvider';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

/**
 * MainLayout Component
 * Primary application shell that provides the sidebar navigation, header controls, and content area.
 * Implements role-based menu filtering, theme switching (Light/Dark), and responsive drawer-based navigation for mobile.
 */
export const MainLayout = () => {
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [collapsed, setCollapsed] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [companyName, setCompanyName] = useState('MastERP');
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved === 'light' ? false : true;
    });
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, hasRole, hasPermission } = useAuth();
    const [filteredMenuItems, setFilteredMenuItems] = useState<MenuProps['items']>([]);

    /**
     * Recursively filters menu items based on the current user's roles and permissions.
     */
    useEffect(() => {
        const filterItems = (items: AppMenuItem[]): any[] => {
            return items.reduce((acc: any[], item) => {
                // Check role requirements
                if (item.roles && item.roles.length > 0) {
                    const hasAllowedRole = item.roles.some(role => hasRole(role));
                    if (!hasAllowedRole) return acc;
                }
                // Check permission requirements
                if (item.permissions && item.permissions.length > 0) {
                    const hasAllowedPermission = item.permissions.some(permission => hasPermission(permission));
                    if (!hasAllowedPermission) return acc;
                }
                
                const { labelKey, roles: itemRoles, permissions: itemPermissions, ...menuItemProps } = item;
                const translatedLabel = labelKey ? t(labelKey) : item.label;

                if (item.children) {
                    const filteredChildren = filterItems(item.children);
                    // Only include parent if it has at least one visible child or is a direct leaf itself
                    if (filteredChildren.length > 0 || (item.key && !item.children.length)) {
                        acc.push({ 
                            ...menuItemProps, 
                            label: translatedLabel,
                            children: filteredChildren.length > 0 ? filteredChildren : undefined 
                        });
                    } else if (item.children.length > 0 && filteredChildren.length === 0) {
                        return acc;
                    } else {
                        acc.push({ ...menuItemProps, label: translatedLabel, children: undefined });
                    }
                } else {
                    acc.push({ ...menuItemProps, label: translatedLabel });
                }
                return acc;
            }, []);
        };
        const visibleItems = filterItems(menuItems);
        setFilteredMenuItems(visibleItems as MenuProps['items']);
    }, [user, hasRole, hasPermission, t, i18n.language]);

    /**
     * Fetches custom branding (Company Name & Logo) from settings.
     */
    useEffect(() => {
        companySettingsApi.getSettings().then(settings => {
            setCompanyName(settings.name);
            if (settings.logoUrl) {
                setCompanyLogo(settings.logoUrl);
            }
        }).catch(err => {
            console.error('Error loading company settings:', err);
        });
    }, []);

    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    const handleMenuClick = ({ key }: { key: string }) => {
        navigate(key);
        if (isMobile) {
            setDrawerVisible(false);
        }
    };

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    /**
     * Renders the branding logo in the sidebar header.
     */
    const renderLogo = (isCollapsed: boolean) => (
        <div style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            paddingLeft: isCollapsed ? 0 : 16,
            paddingRight: isCollapsed ? 0 : 16,
            color: isDarkMode ? '#fff' : '#000',
            background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            gap: 12,
        }}>
            {companyLogo && (
                <img
                    src={companyLogo}
                    alt="Business Logo"
                    style={{
                        height: isCollapsed ? 40 : 48,
                        width: 'auto',
                        aspectRatio: '1',
                        objectFit: 'cover',
                        borderRadius: '50%',
                        border: `2px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                    }}
                />
            )}
            {!isCollapsed && (
                <span style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}>
                    {companyName}
                </span>
            )}
        </div>
    );

    const sidebarMenu = (
        <>
            {renderLogo(isMobile ? false : collapsed)}
            <Menu
                theme={isDarkMode ? 'dark' : 'light'}
                mode="inline"
                selectedKeys={[location.pathname]}
                items={filteredMenuItems}
                onClick={handleMenuClick}
            />
        </>
    );

    const isCashier = user?.role === 'CASHIER';

    return (
        <Layout style={{ minHeight: '100vh' }}>
            {!isMobile && !isCashier && (
                <Sider
                    trigger={null}
                    collapsible
                    collapsed={collapsed}
                    theme={isDarkMode ? 'dark' : 'light'}
                    style={{
                        overflow: 'auto',
                        height: '100vh',
                        position: 'fixed',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        zIndex: 100,
                    }}
                >
                    {sidebarMenu}
                </Sider>
            )}

            {isMobile && !isCashier && (
                <Drawer
                    placement="left"
                    onClose={() => setDrawerVisible(false)}
                    open={drawerVisible}
                    styles={{ 
                        body: { padding: 0 },
                        wrapper: { width: 250 }
                    }}
                    closable={false}
                >
                    <div style={{ height: '100%', background: isDarkMode ? '#001529' : '#fff' }}>
                        {sidebarMenu}
                    </div>
                </Drawer>
            )}

            <Layout style={{
                marginLeft: isMobile || isCashier ? 0 : (collapsed ? 80 : 200),
                transition: 'margin-left 0.2s',
                minWidth: 0
            }}>
                {!isCashier && (
                    <Header style={{
                        padding: isMobile ? '0 12px' : '0 24px',
                        background: isDarkMode ? '#001529' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 99,
                        width: '100%',
                    }}>
                        <Button
                            type="text"
                            icon={isMobile ? <MenuUnfoldOutlined /> : (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
                            onClick={() => isMobile ? setDrawerVisible(true) : setCollapsed(!collapsed)}
                            style={{ fontSize: '16px', width: 64, height: 64, color: isDarkMode ? '#fff' : '#000' }}
                        />

                        <Space size="large">
                            {!isMobile && (
                                <Segmented
                                    options={[
                                        { label: 'ES', value: 'es' },
                                        { label: 'EN', value: 'en' },
                                    ]}
                                    value={i18n.language.startsWith('es') ? 'es' : 'en'}
                                    onChange={(val) => changeLanguage(val as string)}
                                />
                            )}
                            <Button
                                type="text"
                                icon={isDarkMode ? <span>☀️</span> : <span>🌙</span>}
                                onClick={toggleTheme}
                                size={isMobile ? "middle" : "large"}
                                title={t('common.switch_theme')}
                                style={{ color: isDarkMode ? '#fff' : '#000' }}
                            />
                            <Button type="text" icon={<BellOutlined />} size={isMobile ? "middle" : "large"} style={{ color: isDarkMode ? '#fff' : '#000' }} />
                            <Dropdown menu={{
                                items: [
                                    {
                                        key: 'logout',
                                        label: t('menu.sign_out'),
                                        icon: <LogoutOutlined />,
                                        onClick: logout,
                                        danger: true
                                    }
                                ]
                            }}>
                                <Space style={{ cursor: 'pointer' }}>
                                    <Avatar icon={<UserOutlined />} size={isMobile ? "small" : "default"} />
                                    {!isMobile && (
                                        <Text strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
                                            {user?.name || 'User'}
                                        </Text>
                                    )}
                                </Space>
                            </Dropdown>
                        </Space>
                    </Header>
                )}

                <Content style={{
                    margin: location.pathname.includes('/pos') || isCashier ? '0' : (isMobile ? '4px' : '24px 16px'),
                    padding: location.pathname.includes('/pos') || isCashier ? 0 : (isMobile ? 12 : 24),
                    background: '#fff',
                    minHeight: 280,
                    borderRadius: isMobile || isCashier ? 0 : 8,
                    overflow: 'auto'
                }}>
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
};
