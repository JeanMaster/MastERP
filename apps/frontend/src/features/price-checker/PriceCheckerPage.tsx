import { useState, useRef, useEffect } from 'react';
import { Layout, Input, Row, Col, Card, Typography, Button, Spin, Empty, FloatButton, Breadcrumb } from 'antd';
import { SearchOutlined, ArrowLeftOutlined, BarcodeOutlined, ShopOutlined, AppstoreOutlined, HomeOutlined } from '@ant-design/icons';
import { productsApi, type Product } from '../../services/productsApi';
import { departmentsApi, type Department } from '../../services/departmentsApi';
import { companySettingsApi } from '../../services/companySettingsApi';
import { ProductDetailModal } from './ProductDetailModal';
import { useNavigate } from 'react-router-dom';
import { formatVenezuelanPrice } from '../../utils/formatters';
import { getRoundedPrice } from '../../utils/rounding';
import { useTranslation } from 'react-i18next';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

/**
 * PriceCheckerPage Component
 * A high-visibility interface designed for customer-facing terminals or fast inventory lookups.
 * Allows users to browse products by department, search by name, or scan barcodes.
 * Implements dual-currency pricing logic (Primary/Secondary) and POS rounding rules.
 * Supports internationalization (i18n).
 */
export const PriceCheckerPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
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
            } catch (error) {
                console.error("Error loading initial data", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

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

    const renderDepartmentCard = (dept: Department) => (
        <Col xs={12} sm={8} md={6} lg={4} key={dept.id}>
            <Card
                hoverable
                onClick={() => handleDeptClick(dept)}
                style={{
                    textAlign: 'center',
                    height: 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #91caff',
                    background: '#e6f7ff',
                    borderRadius: 16,
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

        return (
            <Col xs={12} sm={8} md={6} lg={4} key={product.id}>
                <Card
                    hoverable
                    onClick={() => handleProductClick(product)}
                    style={{ height: '100%', borderRadius: 16, overflow: 'hidden', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    styles={{ body: { padding: 12, display: 'flex', flexDirection: 'column', height: '100%' } }}
                >
                    <div style={{
                        height: 140,
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        background: '#fafafa',
                        borderRadius: 12
                    }}>
                        <img
                            alt={product.name}
                            src={(product.images && product.images.length > 0) ? product.images[0] : 'https://via.placeholder.com/200?text=No+Image'}
                            style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }}
                        />
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Text strong style={{
                            fontSize: 14,
                            marginBottom: 8,
                            lineHeight: 1.2,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: 34
                        }}>
                            {product.name}
                        </Text>

                        <div style={{ marginTop: 'auto' }}>
                            <div style={{
                                background: '#f6ffed',
                                border: '1px solid #b7eb8f',
                                borderRadius: 8,
                                padding: '6px 8px',
                                textAlign: 'center',
                                marginBottom: 4
                            }}>
                                <Text strong style={{ color: '#389e0d', fontSize: 20, display: 'block' }}>
                                    {formatVenezuelanPrice(primary, primarySymbol)}
                                </Text>
                                {companySettings?.taxEnabled && (
                                    <span style={{ fontSize: 10, color: product.isTaxExempt ? '#8c8c8c' : '#52c41a', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                        {product.isTaxExempt ? t('price_checker.tax_exempt') : t('price_checker.tax_included')}
                                    </span>
                                )}
                            </div>

                            {secondary > 0 && (
                                <div style={{ textAlign: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 15, fontWeight: 600 }}>
                                        {secondarySymbol} {secondary.toFixed(2)}
                                    </Text>
                                </div>
                            )}
                        </div>
                    </div>
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
            return departments.map(renderDepartmentCard);
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
                background: '#1e293b',
                padding: '0 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '80px',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <BarcodeOutlined style={{ fontSize: '32px', color: '#38bdf8', marginRight: '16px' }} />
                    <Title level={3} style={{ color: 'white', margin: 0, marginRight: 24, fontWeight: 700 }}>{t('price_checker.title')}</Title>

                    {!searchTerm && viewMode !== 'ROOT' && (
                        <Breadcrumb style={{ display: 'flex', alignItems: 'center' }}>
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

                <Button
                    type="primary"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/login')}
                    size="large"
                    style={{ background: '#334155', border: 'none', height: 45 }}
                >
                    {t('price_checker.back_to_login')}
                </Button>
            </Header>

            <Content style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
                {/* Search Bar Container */}
                <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                    <Input.Search
                        ref={searchInputRef}
                        placeholder={t('price_checker.search_placeholder')}
                        allowClear
                        enterButton={
                            <Button type="primary" icon={<SearchOutlined />} size="large" style={{ height: 56, padding: '0 32px' }}>
                                {t('price_checker.search_button')}
                            </Button>
                        }
                        size="large"
                        style={{ maxWidth: '900px', width: '100%' }}
                        styles={{ input: { height: 56, borderRadius: '12px 0 0 12px', fontSize: 18 } }}
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
                />
            </Content>

            <FloatButton.BackTop />
        </Layout>
    );
};
