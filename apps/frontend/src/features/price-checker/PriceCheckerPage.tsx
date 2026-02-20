import { useState, useRef, useEffect } from 'react';
import { Layout, Input, Row, Col, Card, Typography, Button, Spin, Empty, FloatButton, Breadcrumb } from 'antd';
import { SearchOutlined, ArrowLeftOutlined, BarcodeOutlined, ShopOutlined, AppstoreOutlined, HomeOutlined } from '@ant-design/icons';
import { productsApi, type Product } from '../../services/productsApi';
import { departmentsApi, type Department } from '../../services/departmentsApi';
import { companySettingsApi } from '../../services/companySettingsApi';
import { ProductDetailModal } from './ProductDetailModal';
import { useNavigate } from 'react-router-dom';
import { formatVenezuelanPrice } from '../../utils/formatters';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export const PriceCheckerPage = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState<Product[]>([]); // For search results or current category products
    const [loading, setLoading] = useState(false);

    // Navigation State
    const [viewMode, setViewMode] = useState<'ROOT' | 'DEPT' | 'SUBDEPT'>('ROOT');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [currentDept, setCurrentDept] = useState<Department | null>(null);
    const [currentSubDept, setCurrentSubDept] = useState<Department | null>(null);

    // Settings State (for Currency)
    const [companySettings, setCompanySettings] = useState<any>(null);

    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const searchInputRef = useRef<any>(null);

    // Initial Load
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

    // Search Logic
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

            // If only one match, open details
            if (results.length === 1 && (results[0].sku === value || results[0].sku.endsWith(value))) {
                handleProductClick(results[0]);
            }
        } catch (error) {
            console.error("Error searching", error);
        } finally {
            setLoading(false);
        }
    };

    // Load Products for a specific level
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

    // Navigation Handlers
    const handleDeptClick = async (dept: Department) => {
        setCurrentDept(dept);
        setViewMode('DEPT');
        setSearchTerm(''); // Clear search when navigating
        // Load products for this dept (mixed with subdepts)
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
            // If we were in a category before search, we ideally go back there. 
            // For simplicity, if we have nav state, reload that state.
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

    // Price Calculation Helper
    const getDualPrices = (product: Product) => {
        if (!companySettings) return { primary: product.salePrice, secondary: 0, primarySymbol: 'Bs', secondarySymbol: '$' };

        // Assuming Base Currency is ALWAYS defined as Primary in Company Settings or defaulting to 'Bs'
        // But referencing POS Logic: Primary = Bs. Secondary = Preferred Secondary (e.g. USD).
        // Product Price Storage: Usually stored in Base Currency (Bs) unless exchangeRate > 1 (which implies it was calculated from USD)

        const primarySymbol = 'Bs';
        const secondarySymbol = companySettings.preferredSecondaryCurrency?.symbol || '$';
        const secondaryRate = companySettings.preferredSecondaryCurrency?.exchangeRate || 0;

        let priceInPrimary = product.salePrice;

        // Logic from POSPage:
        // 1. Calculate Price in Primary Currency (Bs)
        // If product.currency property exists and is NOT primary, convert to primary.
        if (product.currency && !product.currency.isPrimary) {
            const prodRate = product.currency.exchangeRate || 1;
            priceInPrimary = product.salePrice * prodRate;
        }

        // Apply POS Rounding Logic: Ceil to nearest 10
        priceInPrimary = Math.ceil(priceInPrimary / 10) * 10;

        // 2. Calculate Price in Secondary
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

    // Render Helpers
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
                    borderRadius: 12
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
                    borderRadius: 12
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
                    style={{ height: '100%', borderRadius: 12, overflow: 'hidden' }}
                    bodyStyle={{ padding: 12, display: 'flex', flexDirection: 'column', height: '100%' }}
                >
                    <div style={{
                        height: 140,
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}>
                        <img
                            alt={product.name}
                            src={(product.images && product.images.length > 0) ? product.images[0] : 'https://via.placeholder.com/200?text=No+Image'}
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                        />
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Text strong style={{
                            fontSize: 15,
                            marginBottom: 8,
                            lineHeight: 1.2,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                        }}>
                            {product.name}
                        </Text>

                        <div style={{ marginTop: 'auto' }}>
                            <div style={{
                                background: '#f6ffed',
                                border: '1px solid #b7eb8f',
                                borderRadius: 6,
                                padding: '4px 8px',
                                textAlign: 'center',
                                marginBottom: 4
                            }}>
                                <Text strong style={{ color: '#389e0d', fontSize: 18, display: 'block' }}>
                                    {formatVenezuelanPrice(primary, primarySymbol)}
                                </Text>
                            </div>

                            {secondary > 0 && (
                                <div style={{ textAlign: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 14 }}>
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
        // Search Mode
        if (searchTerm && searchTerm.trim().length > 0) {
            if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
            if (products.length === 0) return <Empty description="No se encontraron productos" />;
            return products.map(renderProductCard);
        }

        // Root Mode: Show Departments
        if (viewMode === 'ROOT') {
            if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
            if (departments.length === 0) return <Empty description="No hay departamentos" />;
            return departments.map(renderDepartmentCard);
        }

        // Dept Mode: Show SubDepts + Products
        if (viewMode === 'DEPT' && currentDept) {
            const subDepts = currentDept.children || [];

            if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;

            const subDeptNodes = subDepts.map(renderSubDeptCard);
            const productNodes = products.map(renderProductCard);

            if (subDeptNodes.length === 0 && productNodes.length === 0) return <Empty description="Categoría vacía" />;

            return [...subDeptNodes, ...productNodes];
        }

        // SubDept Mode: Show Products
        if (viewMode === 'SUBDEPT') {
            if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
            if (products.length === 0) return <Empty description="Categoría vacía" />;
            return products.map(renderProductCard);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Header style={{
                background: '#001529',
                padding: '0 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '80px',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <BarcodeOutlined style={{ fontSize: '32px', color: '#1890ff', marginRight: '16px' }} />
                    <Title level={3} style={{ color: 'white', margin: 0, marginRight: 24 }}>Visor de Precios</Title>

                    {/* Breadcrumbs / Navigation Info */}
                    {!searchTerm && viewMode !== 'ROOT' && (
                        <Breadcrumb style={{ display: 'flex', alignItems: 'center' }}>
                            <Breadcrumb.Item onClick={handleHomeClick} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
                                <HomeOutlined /> Inicio
                            </Breadcrumb.Item>
                            {currentDept && (
                                <Breadcrumb.Item onClick={() => currentSubDept && handleDeptClick(currentDept)} style={{ cursor: currentSubDept ? 'pointer' : 'default', color: 'rgba(255,255,255,0.7)' }}>
                                    {currentDept.name}
                                </Breadcrumb.Item>
                            )}
                            {currentSubDept && (
                                <Breadcrumb.Item style={{ color: 'white' }}>
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
                >
                    Salir
                </Button>
            </Header>

            <Content style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
                {/* Search Bar */}
                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                    <Input.Search
                        ref={searchInputRef}
                        placeholder="Escanea el código de barras o escribe el nombre..."
                        allowClear
                        enterButton={<Button type="primary" icon={<SearchOutlined />} size="large">Buscar</Button>}
                        size="large"
                        style={{ maxWidth: '800px', width: '100%' }}
                        onSearch={handleSearch}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        value={searchTerm}
                        autoFocus
                    />
                </div>

                {/* Back Button for Navigation */}
                {(viewMode !== 'ROOT' || (searchTerm && searchTerm.length > 0)) && (
                    <div style={{ marginBottom: 16 }}>
                        <Button onClick={handleBackClick} icon={<ArrowLeftOutlined />} size="large">
                            Regresar
                        </Button>
                    </div>
                )}

                {/* Grid Content */}
                <Row gutter={[16, 16]}>
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
