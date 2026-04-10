import { useState, useEffect } from 'react';
import { Button, Row, Col, Card, Spin, Popover, Image, Tooltip, Modal } from 'antd';
import { ShopOutlined, ArrowLeftOutlined, AppstoreOutlined, PictureOutlined } from '@ant-design/icons';
import { departmentsApi } from '../../../services/departmentsApi';
import type { Department } from '../../../services/departmentsApi';
import { productsApi } from '../../../services/productsApi';
import type { Product } from '../../../services/productsApi';
import { usePOSStore } from '../../../store/posStore';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import { getRoundedPrice } from '../../../utils/rounding';

export const POSRightPanel = () => {
    const { addItem, searchTerm, searchResults, setSearchTerm, setSearchResults } = usePOSStore();
    const isSearching = !!(searchTerm && searchTerm.length > 2);


    // Navigation State
    const [viewMode, setViewMode] = useState<'ROOT' | 'DEPT' | 'SUBDEPT'>('ROOT');
    const [currentDept, setCurrentDept] = useState<Department | null>(null);
    const [currentSubDept, setCurrentSubDept] = useState<Department | null>(null);

    // Data State
    const [departments, setDepartments] = useState<Department[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);

    // Initial Load: Get Department Tree
    useEffect(() => {
        loadDepartments();
    }, []);

    const loadDepartments = async () => {
        setLoading(true);
        try {
            const data = await departmentsApi.getTree();
            setDepartments(data);
        } finally {
            setLoading(false);
        }
    };

    // Load Products for specific level
    const loadProducts = async (deptId: string, subDeptId?: string) => {
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

    // Handlers
    const handleDeptClick = async (dept: Department) => {
        setCurrentDept(dept);
        setViewMode('DEPT');
        // If we want to show products mixed with subdepts in Level 1 (Dept), we'd fetch here.
        // For now, Level 1 shows SubDepts. Level 2 shows Products.
        // User requested "load subdepartments and products of that department".
        // So we will try to load products for this dept too, to mix them if needed.
        await loadProducts(dept.id);
    };

    const handleSubDeptClick = async (subDept: Department) => {
        setCurrentSubDept(subDept);
        setViewMode('SUBDEPT');
        await loadProducts(currentDept!.id, subDept.id);
    };

    const handleProductClick = (product: Product) => {
        // Stock Validation
        const store = usePOSStore.getState();
        const existingItemsForThisProduct = store.cart.filter(item => item.product.id === product.id);
        const currentNormalizedQuantity = existingItemsForThisProduct.reduce((acc, item) =>
            acc + store.getNormalizedQuantity(item.quantity, item.product, item.isSecondaryUnit), 0
        );

        const addedNormalizedQuantity = store.getNormalizedQuantity(1, product, false);

        if (product.type !== 'SERVICE' && (currentNormalizedQuantity + addedNormalizedQuantity) > Number(product.stock)) {
            // Fallback: Try adding secondary unit if available
            if (product.secondaryUnitId) {
                const addedSecondaryNormalizedQuantity = store.getNormalizedQuantity(1, product, true);
                if ((currentNormalizedQuantity + addedSecondaryNormalizedQuantity) <= Number(product.stock)) {
                    addItem(product, true);
                    return;
                }
            }

            Modal.warning({
                title: 'Stock insuficiente',
                content: `${product.name} no tiene stock suficiente para agregar una unidad completa. Disponible: ${product.stock}`,
            });
            return;
        }

        addItem(product, false);
        // Explicitly clear search after adding to avoid visual artifacts
        if (isSearching) {
            setSearchTerm('');
            setSearchResults([]);
        }
    };

    const handleBack = () => {
        if (isSearching) {
            setSearchTerm('');
            setSearchResults([]);
            return;
        }

        if (viewMode === 'SUBDEPT') {
            setViewMode('DEPT');
            setCurrentSubDept(null);
            loadProducts(currentDept!.id); // Reload Level 1 products
        } else if (viewMode === 'DEPT') {
            setViewMode('ROOT');
            setCurrentDept(null);
            setProducts([]); // Clear products
        }
    };

    const renderProductCard = (prod: Product) => (
        <Col xs={12} sm={8} lg={8} key={prod.id}>
            <Card
                hoverable
                onMouseDown={() => handleProductClick(prod)}
                bodyStyle={{ padding: '8px 6px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                style={{ textAlign: 'center', height: 145, cursor: 'pointer', overflow: 'hidden', border: '1px solid #f0f0f0' }}
            >
                {/* Product Thumbnail with Hover Preview */}
                <Popover
                    content={
                        prod.images && prod.images.length > 0 ? (
                            <Image
                                src={prod.images[0]}
                                alt={prod.name}
                                style={{ maxWidth: 250, maxHeight: 250, borderRadius: 8 }}
                                preview={false}
                            />
                        ) : (
                            <div style={{ padding: '10px', color: '#888' }}>Sin imagen disponible</div>
                        )
                    }
                    title={prod.name}
                    trigger="hover"
                    placement="right"
                    mouseEnterDelay={0.3}
                >
                    <div style={{
                        marginBottom: 6,
                        width: 44,
                        height: 44,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        background: '#fafafa',
                        overflow: 'hidden',
                        border: '1px solid #f0f0f0',
                        flexShrink: 0
                    }}>
                        {prod.images && prod.images.length > 0 ? (
                            <Image
                                src={prod.images[0]}
                                alt={prod.name}
                                width={44}
                                height={44}
                                style={{ objectFit: 'cover' }}
                                preview={false}
                            />
                        ) : (
                            <PictureOutlined style={{ color: '#ccc', fontSize: 20 }} />
                        )}
                    </div>
                </Popover>

                <Tooltip title={prod.name} mouseEnterDelay={0.5}>
                    <div style={{
                        fontSize: 12,
                        fontWeight: 'bold',
                        lineHeight: '1.2',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        maxHeight: 30,
                        width: '100%',
                        marginBottom: 4,
                        padding: '0 4px'
                    }}>
                        {prod.name}
                    </div>
                </Tooltip>
                <TagPrice product={prod} />
            </Card>
        </Col>
    );

    // Render Logic
    const renderContent = () => {
        if (loading) {
            return <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>;
        }

        // 0. SEARCH MODE (Global)
        if (searchTerm && searchTerm.length > 2) {
            if (searchResults.length === 0) {
                return (
                    <Col span={24}>
                        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                            <div style={{ fontSize: 16 }}>No se encontraron productos para "{searchTerm}"</div>
                        </div>
                    </Col>
                );
            }
            return searchResults.map(renderProductCard);
        }

        // VIEW: ROOT (Departments)
        if (viewMode === 'ROOT') {
            return departments.map(dept => (
                <Col xs={12} sm={8} lg={8} key={dept.id}>
                    <Card
                        hoverable
                        onClick={() => handleDeptClick(dept)}
                        style={{ background: '#e6f7ff', borderColor: '#91caff', textAlign: 'center', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <ShopOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                        <div style={{ fontWeight: 'bold', marginTop: 8, fontSize: 14 }}>{dept.name}</div>
                    </Card>
                </Col>
            ));
        }

        // VIEW: DEPT (SubDepartments + Direct Products)
        if (viewMode === 'DEPT' && currentDept) {
            // Show SubDepts (children) AND Products
            const subDepts = currentDept.children || [];

            const subDeptNodes = subDepts.map(sub => (
                <Col xs={12} sm={8} lg={8} key={sub.id}>
                    <Card
                        hoverable
                        onClick={() => handleSubDeptClick(sub)}
                        style={{ background: '#f9f0ff', borderColor: '#d3adf7', textAlign: 'center', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <AppstoreOutlined style={{ fontSize: 32, color: '#722ed1' }} />
                        <div style={{ fontWeight: 'bold', marginTop: 8, fontSize: 14 }}>{sub.name}</div>
                    </Card>
                </Col>
            ));

            const productNodes = products.map(renderProductCard);

            return [...subDeptNodes, ...productNodes];
        }

        // VIEW: SUBDEPT (Products only)
        if (viewMode === 'SUBDEPT') {
            return products.map(renderProductCard);
        }
    };

    const TagPrice = ({ product }: { product: Product }) => {
        const { calculatePriceInPrimary, calculatePriceInCurrency, preferredSecondaryCurrency, primaryCurrency, taxEnabled, taxRate, roundingEnabled, roundingFactor } = usePOSStore();

        // 1. Calculate Price in Primary Currency (Bs)
        let rawPriceInPrimary = calculatePriceInPrimary(product, false);

        // Add IVA if enabled and product is not exempt
        if (taxEnabled && !product.isTaxExempt) {
            rawPriceInPrimary = rawPriceInPrimary * (1 + taxRate / 100);
        }

        const priceInPrimary = getRoundedPrice(rawPriceInPrimary, roundingFactor, roundingEnabled);

        // 2. Calculate Price in Preferred Secondary Currency
        const priceInSecondary = preferredSecondaryCurrency
            ? calculatePriceInCurrency(priceInPrimary, preferredSecondaryCurrency.id)
            : 0;

        // 3. Original Price Info
        const originalSymbol = product.currency?.symbol || '$';
        const originalPrice = product.salePrice;
        const isOriginalSameAsPrimary = product.currencyId === primaryCurrency?.id;
        const isOriginalSameAsSecondary = preferredSecondaryCurrency?.code === product.currency?.name;

        return (
            <div style={{ marginTop: 8, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {/* Primary Currency (Prominent) */}
                <div
                    style={{
                        background: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        color: '#52c41a',
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 'bold',
                        width: '100%',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                    title={formatVenezuelanPrice(priceInPrimary, primaryCurrency?.symbol, 2, false)}
                >
                    {formatVenezuelanPrice(priceInPrimary, primaryCurrency?.symbol, 2, false)}
                </div>

                {taxEnabled && (
                    <div style={{ fontSize: 9, color: product.isTaxExempt ? '#888' : '#52c41a', marginTop: -2, fontWeight: 'bold' }}>
                        {product.isTaxExempt ? 'EXENTO' : 'IVA INCL.'}
                    </div>
                )}

                {/* Secondary & Ref Prices Row */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 10,
                    color: '#666',
                    width: '100%',
                    overflow: 'hidden'
                }}>
                    {/* Original Currency (Ref) */}
                    {!isOriginalSameAsPrimary && (
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Ref: <strong style={{ color: '#595959' }}>
                                {formatVenezuelanPrice(Number(originalPrice), originalSymbol, 2, false)}
                            </strong>
                        </span>
                    )}

                    {/* Divider if both exist */}
                    {(!isOriginalSameAsPrimary && preferredSecondaryCurrency && priceInSecondary > 0 && !isOriginalSameAsSecondary) && (
                        <span style={{ color: '#ccc' }}>|</span>
                    )}

                    {/* Secondary Currency */}
                    {preferredSecondaryCurrency && priceInSecondary > 0 && !isOriginalSameAsSecondary && (
                        <span style={{ color: '#1890ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {preferredSecondaryCurrency.symbol} <strong>{priceInSecondary.toFixed(2)}</strong>
                        </span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Navegación Superior */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'white', padding: 5, borderRadius: 4 }}>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={handleBack}
                    disabled={viewMode === 'ROOT' && !isSearching}
                >
                    Regresar
                </Button>
                <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold' }}>
                    {isSearching ? `Resultados para: "${searchTerm}"` : (
                        <>
                            {viewMode === 'ROOT' && 'Departamentos'}
                            {viewMode === 'DEPT' && currentDept?.name}
                            {viewMode === 'SUBDEPT' && `${currentDept?.name} > ${currentSubDept?.name}`}
                        </>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                    <Button disabled>Más...</Button>
                </div>
            </div>

            {/* Grid de Productos */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 5 }}>
                <Row gutter={[10, 10]}>
                    {renderContent()}
                    {!loading && viewMode !== 'ROOT' && products.length === 0 && (!currentDept?.children?.length) && (
                        <div style={{ width: '100%', textAlign: 'center', color: '#999', padding: 20 }}>No hay items</div>
                    )}
                </Row>
            </div>
        </div>
    );
};
