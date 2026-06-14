import { useState, useRef, useEffect } from 'react';
import { Layout, Input, Row, Col, Card, Typography, Button, Spin, Empty, FloatButton, Breadcrumb, Grid, Drawer, Select, message, Space, Badge } from 'antd';
import { SearchOutlined, ArrowLeftOutlined, ShopOutlined, AppstoreOutlined, HomeOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { productsApi, type Product } from '../../services/productsApi';
import { departmentsApi, type Department } from '../../services/departmentsApi';
import { companySettingsApi } from '../../services/companySettingsApi';
import { cashRegisterApi } from '../../services/cashRegisterApi';
import { salesApi } from '../../services/salesApi';
import { ProductDetailModal } from './ProductDetailModal';
import { ClientSelectionModal } from '../pos/components/ClientSelectionModal';
import { useNavigate } from 'react-router-dom';
import { formatVenezuelanPrice } from '../../utils/formatters';
import { getRoundedPrice } from '../../utils/rounding';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';

const { Header, Content, Sider } = Layout;
const { useBreakpoint } = Grid;
const { Title, Text } = Typography;

interface CartItem {
    product: Product;
    quantity: number;
    price: number;
    tax: number;
    discount: number;
    discountPercent: number;
    total: number;
    isSecondaryUnit: boolean;
}

/**
 * PriceCheckerPage Component
 * A high-visibility interface designed for customer-facing terminals or fast inventory lookups.
 * Allows users to browse products by department, search by name, or scan barcodes.
 * Implements dual-currency pricing logic (Primary/Secondary) and POS rounding rules.
 * Supports internationalization (i18n).
 * When authenticated as SELLER, enables pre-sale mode with cart functionality.
 */
export const PriceCheckerPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const { user } = useAuth();
    const isSellerMode = user?.role === 'SELLER' || user?.role === 'ADMIN' || user?.role === 'MANAGER';
    
    // Pre-sale mode state
    const [cart, setCart] = useState<CartItem[]>([]);
    const [activeCustomer, setActiveCustomer] = useState<string>('CONTADO');
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [selectedRegisterId, setSelectedRegisterId] = useState<string>('');
    const [registers, setRegisters] = useState<any[]>([]);
    const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);

    // Navigation State
    const [viewMode, setViewMode] = useState<'ROOT' | 'DEPT' | 'SUBDEPT'>('ROOT');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [currentDept, setCurrentDept] = useState<Department | null>(null);
    const [currentSubDept, setCurrentSubDept] = useState<Department | null>(null);

    // Business Logic Settings
    const [companySettings, setCompanySettings] = useState<any>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const searchInputRef = useRef<any>(null);

    /**
     * Loads the department hierarchy and global tax/currency settings on mount.
     */
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [deptTree, settings] = await Promise.all([
                    departmentsApi.getTree(),
                    companySettingsApi.getSettings()
                ]);
                setDepartments(deptTree);
                setCompanySettings(settings);
                
                // Load registers for seller mode
                if (isSellerMode) {
                    const regs = await cashRegisterApi.listRegisters();
                    setRegisters(regs.filter((r: any) => r.isActive));
                }
            } catch (error) {
                console.error("Error loading initial data", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [isSellerMode]);

    /**
     * Executes product lookup by SKU/Barcode or Name.
     */
    const handleSearch = async (value: string) => {
        if (!value.trim()) {
            if (viewMode === 'ROOT') setProducts([]);
            return;
        }

        setLoading(true);
        try {
            const results = await productsApi.getAll({
                search: value,
                active: true,
                limit: 20
            });
            setProducts(results);

            // Instant modal popup if a direct barcode match is found
            if (results.length === 1 && (results[0].sku === value || results[0].sku.endsWith(value))) {
                handleProductClick(results[0]);
            }
        } catch (error) {
            console.error("Error searching products", error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Loads products filtered by Department and/or Sub-department.
     */
    const loadCategoryProducts = async (deptId: string, subDeptId?: string) => {
        setLoading(true);
        try {
            const data = await productsApi.getAll({
                categoryId: deptId,
                subcategoryId: subDeptId,
                active: true
            });
            setProducts(data);
        } finally {
            setLoading(false);
        }
    };

    const handleDeptClick = async (dept: Department) => {
        setCurrentDept(dept);
        setViewMode('DEPT');
        setSearchTerm('');
        await loadCategoryProducts(dept.id);
    };

    const handleSubDeptClick = async (subDept: Department) => {
        setCurrentSubDept(subDept);
        setViewMode('SUBDEPT');
        setSearchTerm('');
        await loadCategoryProducts(currentDept!.id, subDept.id);
    };

    const handleHomeClick = () => {
        setViewMode('ROOT');
        setCurrentDept(null);
        setCurrentSubDept(null);
        setProducts([]);
        setSearchTerm('');
        if (searchInputRef.current) searchInputRef.current.focus();
    };

    const handleBackClick = () => {
        if (searchTerm) {
            setSearchTerm('');
            setProducts([]);
            if (currentSubDept) {
                loadCategoryProducts(currentDept!.id, currentSubDept.id);
            } else if (currentDept) {
                loadCategoryProducts(currentDept.id);
            }
            return;
        }

        if (viewMode === 'SUBDEPT') {
            setViewMode('DEPT');
            setCurrentSubDept(null);
            loadCategoryProducts(currentDept!.id);
        } else if (viewMode === 'DEPT') {
            setViewMode('ROOT');
            setCurrentDept(null);
            setProducts([]);
        }
    };

    const handleProductClick = (product: Product) => {
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedProduct(null);
        setSearchTerm('');
        if (searchInputRef.current) {
            setTimeout(() => searchInputRef.current.focus(), 100);
        }
    };

    /**
     * Calculates the dual-currency final price considering tax rules and POS rounding rules.
     */
    const getDualPrices = (product: Product) => {
        if (!companySettings) return { primary: product.salePrice, secondary: 0, primarySymbol: 'Bs', secondarySymbol: '$' };

        const primarySymbol = 'Bs';
        const secondarySymbol = companySettings.preferredSecondaryCurrency?.symbol || '$';
        const secondaryRate = companySettings.preferredSecondaryCurrency?.exchangeRate || 0;

        let priceInPrimary = product.salePrice;

        // 1. Currency normalization
        if (product.currency && !product.currency.isPrimary) {
            const prodRate = product.currency.exchangeRate || 1;
            priceInPrimary = product.salePrice * prodRate;
        }

        // 2. Tax Application (VAT/IVA)
        if (companySettings.taxEnabled && !product.isTaxExempt) {
            priceInPrimary = priceInPrimary * (1 + (Number(companySettings.taxRate) || 16) / 100);
        }

        // 3. POS Rounding Logic
        const roundingEnabled = companySettings.roundingEnabled !== undefined ? companySettings.roundingEnabled : true;
        const roundingFactor = companySettings.roundingFactor || 10;
        priceInPrimary = getRoundedPrice(priceInPrimary, roundingFactor, roundingEnabled);

        // 4. Secondary Currency conversion
        let priceInSecondary = 0;
        if (secondaryRate > 0) {
            priceInSecondary = priceInPrimary / secondaryRate;
        }

        return {
            primary: priceInPrimary,
            primarySymbol,
            secondary: priceInSecondary,
            secondarySymbol
        };
    };

    // Cart helper functions for pre-sale mode
    const calculateCartTotal = () => {
        return cart.reduce((sum, item) => sum + item.total, 0);
    };

    const handleAddToCart = (product: Product, isSecondary: boolean = false) => {
        const { primary } = getDualPrices(product);
        const existingItem = cart.find(
            (item) => item.product.id === product.id && item.isSecondaryUnit === isSecondary
        );

        const stock = product.stock || 0;
        const newQuantity = existingItem ? existingItem.quantity + 1 : 1;

        // Validate stock BEFORE adding
        if (stock === 0) {
            message.error(`${product.name} ${t('price_checker.out_of_stock')}`);
            return;
        }

        if (stock < newQuantity) {
            message.warning(`${product.name}: ${t('price_checker.low_stock', { available: stock })}`);
            return;
        }

        if (existingItem) {
            setCart(cart.map(item => 
                item.product.id === product.id && item.isSecondaryUnit === isSecondary
                    ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
                    : item
            ));
        } else {
            const newItem: CartItem = {
                product,
                quantity: 1,
                price: primary,
                tax: 0,
                discount: 0,
                discountPercent: 0,
                total: primary,
                isSecondaryUnit: isSecondary
            };
            setCart([...cart, newItem]);
        }

        message.success(`+1 ${product.name}`);
    };

    const handleRemoveFromCart = (productId: string) => {
        setCart(cart.filter(item => item.product.id !== productId));
    };

    const handleSelectCustomer = (customer: { id: string; name: string } | string) => {
        if (typeof customer === 'string') {
            setActiveCustomer(customer);
            setCustomerId(null);
        } else {
            setActiveCustomer(customer.name);
            setCustomerId(customer.id);
        }
        setIsClientModalOpen(false);
    };

    const handleParkSale = async () => {
        if (cart.length === 0) return;
        if (!selectedRegisterId) {
            message.error(t('pos.parked.select_register_required'));
            return;
        }

        try {
            const cartForBackend = cart.map(item => ({
                productId: item.product.id,
                quantity: item.quantity,
                unitPrice: item.price,
            }));
            await salesApi.parkSale({
                registerId: selectedRegisterId,
                cart: cartForBackend,
                activeCustomer,
                customerId: customerId || undefined,
                totals: {
                    total: calculateCartTotal(),
                    itemsCount: cart.reduce((sum, item) => sum + item.quantity, 0),
                },
            });
            setCart([]);
            setActiveCustomer('CONTADO');
            setCustomerId(null);
            message.success(t('pos.parked.parked_success'));
            setIsCartDrawerOpen(false);
        } catch (error) {
            console.error('Failed to park sale:', error);
            message.error(t('pos.parked.park_error'));
        }
    };

    const renderDepartmentCard = (dept: Department) => (
        <Col xs={24} sm={12} md={8} lg={6} key={dept.id}>
            <Card
                hoverable
                onClick={() => handleDeptClick(dept)}
                style={{
                    textAlign: 'center',
                    height: isMobile ? 100 : 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #91caff',
                    background: '#e6f7ff',
                    borderRadius: 12,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <ShopOutlined style={{ fontSize: 40, color: '#1890ff', marginBottom: 12 }} />
                    <Title level={5} style={{ margin: 0, fontSize: 16 }}>{dept.name}</Title>
                </div>
            </Card>
        </Col>
    );

    const renderSubDeptCard = (sub: Department) => (
        <Col xs={12} sm={8} md={6} lg={4} key={sub.id}>
            <Card
                hoverable
                onClick={() => handleSubDeptClick(sub)}
                style={{
                    textAlign: 'center',
                    height: 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #d3adf7',
                    background: '#f9f0ff',
                    borderRadius: 16,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <AppstoreOutlined style={{ fontSize: 40, color: '#722ed1', marginBottom: 12 }} />
                    <Title level={5} style={{ margin: 0, fontSize: 15 }}>{sub.name}</Title>
                </div>
            </Card>
        </Col>
    );

    const renderProductCard = (product: Product) => {
        const { primary, primarySymbol, secondary, secondarySymbol } = getDualPrices(product);
        const stock = product.stock || 0;
        const isInCart = cart.some(item => item.product.id === product.id);

        return (
            <Col xs={24} sm={12} md={8} lg={6} key={product.id}>
                <Card
                    hoverable
                    onClick={() => handleProductClick(product)}
                    style={{
                        height: '100%',
                        borderRadius: 16,
                        overflow: 'hidden',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                        transition: 'all 0.3s ease'
                    }}
                    styles={{ body: { padding: isMobile ? 8 : 12, display: 'flex', flexDirection: 'column', height: '100%' } }}
                >
                    <div style={{
                        height: isMobile ? 120 : 180,
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        background: '#fafafa',
                        borderRadius: 12,
                        padding: isMobile ? 6 : 0
                    }}>
                        {stock === 0 && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(255,255,255,0.7)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 2
                            }}>
                                <Text type="danger" strong style={{ fontSize: 16, textTransform: 'uppercase' }}>
                                    {t('price_checker.out_of_stock')}
                                </Text>
                            </div>
                        )}
                        <img
                            alt={product.name}
                            src={(product.images && product.images.length > 0) ? product.images[0] : 'https://via.placeholder.com/200?text=No+Image'}
                            style={{
                                maxHeight: '90%',
                                maxWidth: '90%',
                                objectFit: 'contain',
                                borderRadius: 8,
                                opacity: stock === 0 ? 0.5 : 1
                            }}
                        />
                        {stock > 0 && stock <= 5 && (
                            <div style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                background: '#fff7e6',
                                border: '1px solid #ffd581',
                                borderRadius: 12,
                                padding: '2px 8px',
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#d48806'
                            }}>
                                {t('price_checker.low_stock', { available: stock })}
                            </div>
                        )}
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Text strong style={{
                            fontSize: isMobile ? 13 : 14,
                            marginBottom: isMobile ? 6 : 8,
                            lineHeight: 1.3,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: isMobile ? 44 : 36
                        }}>
                            {product.name}
                        </Text>

                        <div style={{ marginTop: 'auto' }}>
                            <div style={{
                                background: '#f6ffed',
                                border: '1px solid #b7eb8f',
                                borderRadius: 8,
                                padding: isMobile ? '6px 6px' : '8px 10px',
                                textAlign: 'center',
                                marginBottom: 8
                            }}>
                                <Text strong style={{ color: '#389e0d', fontSize: isMobile ? 18 : 22, display: 'block' }}>
                                    {formatVenezuelanPrice(primary, primarySymbol)}
                                </Text>
                                {companySettings?.taxEnabled && (
                                    <span style={{ fontSize: 10, color: product.isTaxExempt ? '#8c8c8c' : '#52c41a', fontWeight: 600, textTransform: 'uppercase' }}>
                                        {product.isTaxExempt ? t('price_checker.tax_exempt') : t('price_checker.tax_included')}
                                    </span>
                                )}
                            </div>

                            {secondary > 0 && (
                                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                                    <Text type="secondary" style={{ fontSize: isMobile ? 13 : 15, fontWeight: 600 }}>
                                        {secondarySymbol} {secondary.toFixed(2)}
                                    </Text>
                                </div>
                            )}
                        </div>
                    </div>

                    {isSellerMode && (
                        <Button
                            type={isInCart ? "default" : "primary"}
                            icon={<ShoppingCartOutlined />}
                            onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                            style={{
                                marginTop: 8,
                                width: '100%',
                                height: isMobile ? 36 : 40,
                                fontSize: isMobile ? 12 : 14,
                                borderRadius: 8
                            }}
                            disabled={stock === 0}
                        >
                            {isInCart ? `${t('price_checker.add_to_cart')} (+1)` : t('price_checker.add_to_cart')}
                        </Button>
                    )}
                </Card>
            </Col>
        );
    };

    const renderContent = () => {
        if (searchTerm && searchTerm.trim().length > 0) {
            if (loading) return <div style={{ textAlign: 'center', padding: 50, width: '100%' }}><Spin size="large" /></div>;
            if (products.length === 0) return <div style={{ width: '100%' }}><Empty description={t('price_checker.no_products')} /></div>;
            return products.map(renderProductCard);
        }

        if (viewMode === 'ROOT') {
            if (loading) return <div style={{ textAlign: 'center', padding: 50, width: '100%' }}><Spin size="large" /></div>;
            if (departments.length === 0) return <div style={{ width: '100%' }}><Empty description={t('price_checker.no_categories')} /></div>;
            return (
                <>
                    <div style={{
                        textAlign: 'center',
                        padding: isMobile ? '32px 16px' : '48px 24px',
                        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                        borderRadius: 16,
                        marginBottom: 24
                    }}>
                        <Title level={2} style={{ color: '#0369a1', marginBottom: 8 }}>
                            {t('price_checker.welcome')}
                        </Title>
                        <Text style={{ color: '#64748b', fontSize: isMobile ? 14 : 16 }}>
                            {t('price_checker.welcome_subtitle')}
                        </Text>
                    </div>
                    <Row gutter={[20, 20]}>
                        {departments.map(renderDepartmentCard)}
                    </Row>
                </>
            );
        }

        if (viewMode === 'DEPT' && currentDept) {
            const subDepts = currentDept.children || [];
            if (loading) return <div style={{ textAlign: 'center', padding: 50, width: '100%' }}><Spin size="large" /></div>;

            const subDeptNodes = subDepts.map(renderSubDeptCard);
            const productNodes = products.map(renderProductCard);

            if (subDeptNodes.length === 0 && productNodes.length === 0) return <div style={{ width: '100%' }}><Empty description={t('price_checker.empty_category')} /></div>;
            return [...subDeptNodes, ...productNodes];
        }

        if (viewMode === 'SUBDEPT') {
            if (loading) return <div style={{ textAlign: 'center', padding: 50, width: '100%' }}><Spin size="large" /></div>;
            if (products.length === 0) return <div style={{ width: '100%' }}><Empty description={t('price_checker.empty_subcategory')} /></div>;
            return products.map(renderProductCard);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
            <Header style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                padding: isMobile ? '12px' : '0 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: isMobile ? '64px' : '80px',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <ShopOutlined style={{ fontSize: '32px', color: '#38bdf8', marginRight: '12px' }} />
                    <Title level={3} style={{ color: 'white', margin: 0, fontWeight: 700 }}>{t('price_checker.title')}</Title>

                    {!searchTerm && viewMode !== 'ROOT' && !isMobile && (
                        <Breadcrumb style={{ marginLeft: 24, display: 'flex', alignItems: 'center' }}>
                            <Breadcrumb.Item onClick={handleHomeClick} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}>
                                <HomeOutlined /> {t('price_checker.breadcrumb_start')}
                            </Breadcrumb.Item>
                            {currentDept && (
                                <Breadcrumb.Item onClick={() => currentSubDept && handleDeptClick(currentDept)} style={{ cursor: currentSubDept ? 'pointer' : 'default', color: 'rgba(255,255,255,0.6)' }}>
                                    {currentDept.name}
                                </Breadcrumb.Item>
                            )}
                            {currentSubDept && (
                                <Breadcrumb.Item style={{ color: 'white', fontWeight: 600 }}>
                                    {currentSubDept.name}
                                </Breadcrumb.Item>
                            )}
                        </Breadcrumb>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {!isMobile && isSellerMode && (
                        <Badge count={cart.length > 0 ? cart.length : 0} color="#f59e0b" offset={[-8, 8]}>
                            <Button
                                type="primary"
                                icon={<ShoppingCartOutlined />}
                                onClick={() => setIsCartDrawerOpen(!isCartDrawerOpen)}
                                style={{ background: '#0ea5e9', border: 'none', height: 40 }}
                            >
                                {t('price_checker.cart')}
                            </Button>
                        </Badge>
                    )}
                    <Button
                        type="primary"
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/login')}
                        size="large"
                        style={{ background: '#334155', border: 'none', height: 40 }}
                    >
                        {t('price_checker.back_to_login')}
                    </Button>
                </div>
            </Header>

            <Layout>
                <Content style={{ padding: isMobile ? '12px' : '24px', maxWidth: isMobile ? '100%' : 'calc(100% - 340px)', margin: '0 auto', width: '100%' }}>
                    {/* Search Bar Container */}
                    <div style={{ marginBottom: isMobile ? '16px' : '32px', textAlign: 'center' }}>
                        <Input.Search
                            ref={searchInputRef}
                            placeholder={t('price_checker.search_placeholder')}
                            allowClear
                            enterButton={
                                <Button type="primary" icon={<SearchOutlined />} size={isMobile ? 'middle' : 'large'} style={{ height: isMobile ? 44 : 56, padding: isMobile ? '0 12px' : '0 32px' }}>
                                    {t('price_checker.search_button')}
                                </Button>
                            }
                            size={isMobile ? 'middle' : 'large'}
                            style={{ maxWidth: isMobile ? '100%' : '900px', width: '100%' }}
                            onSearch={handleSearch}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            value={searchTerm}
                            autoFocus
                        />
                    </div>

                    {/* Local Navigation Control */}
                    {(viewMode !== 'ROOT' || (searchTerm && searchTerm.length > 0)) && (
                        <div style={{ marginBottom: 20 }}>
                            <Button 
                                onClick={handleBackClick} 
                                icon={<ArrowLeftOutlined />} 
                                size="large" 
                                style={{ borderRadius: 8, height: 45, display: 'flex', alignItems: 'center' }}
                            >
                                {t('price_checker.return')}
                            </Button>
                        </div>
                    )}

                    {/* Main Grid View */}
                    <Row gutter={[20, 20]}>
                        {renderContent()}
                    </Row>

                    <ProductDetailModal
                        visible={isModalOpen}
                        onClose={handleCloseModal}
                        product={selectedProduct}
                        companySettings={companySettings}
                        onAddToCart={(product, isSecondary) => handleAddToCart(product, isSecondary)}
                    />
                </Content>

                {!isMobile && isSellerMode && (
                    <Sider
                        width={isCartDrawerOpen ? 340 : 0}
                        style={{
                            background: 'white',
                            borderLeft: '1px solid #e2e8f0',
                            padding: isCartDrawerOpen ? 16 : 0,
                            height: 'calc(100vh - 80px)',
                            position: 'sticky',
                            top: 80,
                            transition: 'width 0.3s ease',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <Title level={4} style={{ margin: 0, marginBottom: 16 }}>
                                <ShoppingCartOutlined /> {t('price_checker.cart')} ({cart.length})
                            </Title>

                            {cart.length > 0 ? (
                                <>
                                    <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
                                        {cart.map((item) => (
                                            <Card 
                                                key={item.product.id} 
                                                size="small" 
                                                style={{ marginBottom: 8, borderRadius: 8 }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <Text strong style={{ fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                            {item.product.name}
                                                        </Text>
                                                        <br />
                                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                                            {formatVenezuelanPrice(item.price, 'Bs.')} × {item.quantity}
                                                        </Text>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <Text strong style={{ fontSize: 13 }}>
                                                            {formatVenezuelanPrice(item.total, 'Bs.')}
                                                        </Text>
                                                        <br />
                                                        <Button 
                                                            type="text" 
                                                            danger 
                                                            size="small"
                                                            onClick={() => handleRemoveFromCart(item.product.id)}
                                                        >
                                                            {t('common.delete')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>

                                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <Text strong>{t('pos.parked.customer')}:</Text>
                                            <Button 
                                                type="link" 
                                                onClick={() => setIsClientModalOpen(true)}
                                                style={{ padding: 0, height: 'auto' }}
                                            >
                                                {activeCustomer}
                                            </Button>
                                        </div>

                                        <div style={{ marginBottom: 12 }}>
                                            <Select
                                                placeholder={t('pos.parked.select_register_placeholder')}
                                                style={{ width: '100%' }}
                                                value={selectedRegisterId}
                                                onChange={setSelectedRegisterId}
                                                options={registers.map((r: any) => ({ label: r.name, value: r.id }))}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                            <Title level={5}>{t('pos.parked.total')}:</Title>
                                            <Title level={5} style={{ color: '#0ea5e9', margin: 0 }}>
                                                {formatVenezuelanPrice(calculateCartTotal(), 'Bs.')}
                                            </Title>
                                        </div>

                                        <Button 
                                            type="primary" 
                                            block 
                                            size="large"
                                            onClick={handleParkSale}
                                            disabled={cart.length === 0 || !selectedRegisterId}
                                        >
                                            {t('pos.parked.park_button')}
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <Empty description={t('price_checker.cart_empty')} style={{ flex: 1 }} />
                            )}
                        </div>
                    </Sider>
                )}
            </Layout>

            <ClientSelectionModal
                open={isClientModalOpen}
                onSelect={handleSelectCustomer}
                onCancel={() => setIsClientModalOpen(false)}
            />

            {/* Cart Drawer for Mobile */}
            <Drawer
                title={
                    <Space>
                        <ShoppingCartOutlined />
                        {t('price_checker.cart')} ({cart.length})
                    </Space>
                }
                placement="right"
                onClose={() => setIsCartDrawerOpen(false)}
                open={isCartDrawerOpen && isSellerMode && isMobile}
                size="default"
                extra={
                    <Space>
                        <Button onClick={() => setIsCartDrawerOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button 
                            type="primary" 
                            onClick={handleParkSale}
                            disabled={cart.length === 0 || !selectedRegisterId}
                        >
                            {t('pos.parked.park_button')}
                        </Button>
                    </Space>
                }
            >
                {cart.length > 0 ? (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <Text strong>{t('pos.parked.customer')}:</Text>
                            <Button 
                                type="link" 
                                onClick={() => setIsClientModalOpen(true)}
                                style={{ padding: 0, height: 'auto' }}
                            >
                                {activeCustomer}
                            </Button>
                        </div>
                        
                        <div style={{ marginBottom: 16 }}>
                            <Text strong>{t('pos.parked.select_register')}:</Text>
                            <Select
                                placeholder={t('pos.parked.select_register_placeholder')}
                                style={{ width: '100%', marginTop: 8 }}
                                value={selectedRegisterId}
                                onChange={setSelectedRegisterId}
                                options={registers.map((r: any) => ({ label: r.name, value: r.id }))}
                            />
                        </div>

                        <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', marginBottom: 16 }}>
                            {cart.map((item) => (
                                <Card 
                                    key={item.product.id} 
                                    size="small" 
                                    style={{ marginBottom: 8 }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <Text strong style={{ fontSize: 13 }}>
                                                {item.product.name}
                                            </Text>
                                            <br />
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {formatVenezuelanPrice(item.price, 'Bs.')} x {item.quantity}
                                            </Text>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <Text strong style={{ fontSize: 13 }}>
                                                {formatVenezuelanPrice(item.total, 'Bs.')}
                                            </Text>
                                            <br />
                                            <Button 
                                                type="text" 
                                                danger 
                                                size="small"
                                                onClick={() => handleRemoveFromCart(item.product.id)}
                                            >
                                                {t('common.delete')}
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        <div style={{ borderTop: '1px solid #d9d9d9', paddingTop: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Title level={4}>{t('pos.parked.total')}:</Title>
                                <Title level={4} style={{ color: '#1890ff' }}>
                                    {formatVenezuelanPrice(calculateCartTotal(), 'Bs.')}
                                </Title>
                            </div>
                        </div>
                    </>
                ) : (
                    <Empty description={t('price_checker.cart_empty')} />
                )}
            </Drawer>

            {isSellerMode && isMobile && (
                <FloatButton
                    icon={<ShoppingCartOutlined />}
                    badge={{ count: cart.length, color: '#1890ff' }}
                    onClick={() => setIsCartDrawerOpen(true)}
                    style={{ right: 80 }}
                />
            )}

            <FloatButton.BackTop />
        </Layout>
    );
};
