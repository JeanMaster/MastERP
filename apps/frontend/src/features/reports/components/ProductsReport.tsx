import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Card, Typography, Input, Tag, Grid, Pagination, Row, Col } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { statsApi } from '../../../services/statsApi';
import { ProductDetailsModal } from './ProductDetailsModal';
import { usePOSStore } from '../../../store/posStore';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

export const ProductsReport = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const { t } = useTranslation();
    const { primaryCurrency } = usePOSStore();
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const { data: products = [], isLoading } = useQuery({
        queryKey: ['productsReport', primaryCurrency?.code],
        queryFn: () => statsApi.getProductsReport(primaryCurrency?.code),
        enabled: !!primaryCurrency?.code
    });

    const [searchText, setSearchText] = useState('');
    const filteredProducts = products.filter(product => 
        product.name.toLowerCase().includes(searchText.toLowerCase()) ||
        product.category.toLowerCase().includes(searchText.toLowerCase())
    );

    const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const columns = [
        {
            title: t('common.product'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: any) => (
                <a onClick={() => {
                    setSelectedProduct(record.id);
                    setIsModalVisible(true);
                }}>{text}</a>
            ),
        },
        {
            title: t('common.category'),
            dataIndex: 'category',
            key: 'category',
        },
        {
            title: t('common.stock'),
            dataIndex: 'stock',
            key: 'stock',
            render: (val: number) => <Text strong>{val}</Text>,
        },
        {
            title: t('reports.inventory.velocity'),
            dataIndex: 'dailySalesVelocity',
            key: 'dailySalesVelocity',
            render: (val: number) => val > 0 ? val.toFixed(2) : '-',
        },
        {
            title: t('reports.inventory.days_left'),
            dataIndex: 'daysRemaining',
            key: 'daysRemaining',
            render: (val: number) => {
                if (val === -1) return <Tag>{t('reports.products.no_sales')}</Tag>;
                if (val < 10) return <Tag color="error">{val} {t('common.days')}</Tag>;
                if (val < 30) return <Tag color="warning">{val} {t('common.days')}</Tag>;
                return <Tag color="success">{val} {t('common.days')}</Tag>;
            },
        },
        {
            title: t('reports.inventory.needed_6m'),
            dataIndex: 'unitsNeeded6Months',
            key: 'unitsNeeded6Months',
            render: (val: number) => val > 0 ? val : '-',
        },
    ];

    return (
        <div style={{ padding: '0px' }}>
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                        <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>{t('reports.products.title')}</Title>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Monitoreo de stock, rotación y proyecciones de compra.</Text>
                    </Col>
                    <Col xs={24} lg={8}>
                        <Input 
                            placeholder={t('reports.products.search_placeholder')} 
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} 
                            value={searchText}
                            onChange={e => {
                                setSearchText(e.target.value);
                                setCurrentPage(1);
                            }}
                            size="large"
                            style={{ borderRadius: 12 }}
                            allowClear
                        />
                    </Col>
                </Row>
            </div>
                
            {!isMobile ? (
                <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 24 } }}>
                    <Table
                        columns={columns}
                        dataSource={filteredProducts}
                        rowKey="id"
                        loading={isLoading}
                        pagination={{ 
                            current: currentPage,
                            pageSize: pageSize,
                            onChange: (page, size) => {
                                setCurrentPage(page);
                                setPageSize(size);
                            },
                            showSizeChanger: true, 
                            pageSizeOptions: ['15', '30', '50', '100'] 
                        }}
                        size="middle"
                    />
                </Card>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {paginatedProducts.map((item: any) => (
                        <Card 
                            key={item.id} 
                            variant="borderless"
                            styles={{ body: { padding: 16 } }}
                            style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                            onClick={() => {
                                setSelectedProduct(item.id);
                                setIsModalVisible(true);
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                <Text strong style={{ fontSize: 16, color: '#1890ff', cursor: 'pointer', flex: 1, marginRight: 8, lineHeight: 1.2 }}>{item.name}</Text>
                                <Tag color={item.stock > 10 ? 'success' : item.stock > 0 ? 'warning' : 'error'} style={{ borderRadius: 6, margin: 0 }}>
                                    {item.stock} ud
                                </Tag>
                            </div>
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 12 }}>{item.category.toUpperCase()}</Text>
                            
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>VELOCIDAD DIARIA</Text>
                                    <Text strong style={{ fontSize: 14 }}>{item.dailySalesVelocity > 0 ? item.dailySalesVelocity.toFixed(2) : '-'}</Text>
                                </Col>
                                <Col span={12} style={{ textAlign: 'right' }}>
                                    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>DÍAS RESTANTES</Text>
                                    <div style={{ marginTop: 2 }}>
                                        {item.daysRemaining === -1 ? (
                                            <Tag style={{ margin: 0, borderRadius: 6 }}>{t('reports.products.no_sales')}</Tag>
                                        ) : (
                                            <Tag color={item.daysRemaining < 10 ? 'error' : item.daysRemaining < 30 ? 'warning' : 'success'} style={{ margin: 0, borderRadius: 6, fontWeight: 700 }}>
                                                {item.daysRemaining} {t('common.days')}
                                            </Tag>
                                        )}
                                    </div>
                                </Col>
                            </Row>
                            
                            {item.unitsNeeded6Months > 0 && (
                                <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff7e6', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, color: '#d46b08' }}>Proyección 6 meses:</Text>
                                    <Text strong style={{ color: '#d46b08', fontSize: 14 }}>{item.unitsNeeded6Months} uds</Text>
                                </div>
                            )}
                        </Card>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, paddingBottom: 24 }}>
                        <Pagination 
                            current={currentPage}
                            total={filteredProducts.length}
                            pageSize={pageSize}
                            onChange={setCurrentPage}
                            size="default"
                            showSizeChanger={false}
                        />
                    </div>
                </div>
            )}

            {selectedProduct && (
                <ProductDetailsModal
                    productId={selectedProduct}
                    visible={isModalVisible}
                    onClose={() => setIsModalVisible(false)}
                />
            )}
        </div>
    );
};
