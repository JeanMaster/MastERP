import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Card, Typography, Space, Input, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { statsApi } from '../../../services/statsApi';
import { ProductDetailsModal } from './ProductDetailsModal';
import { usePOSStore } from '../../../store/posStore';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

export const ProductsReport = () => {
    const { t } = useTranslation();
    const { primaryCurrency } = usePOSStore();
    const [searchText, setSearchText] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const { data: products = [], isLoading } = useQuery({
        queryKey: ['productsReport', primaryCurrency?.code],
        queryFn: () => statsApi.getProductsReport(primaryCurrency?.code),
        enabled: !!primaryCurrency?.code
    });

    const filteredProducts = products.filter(product => 
        product.name.toLowerCase().includes(searchText.toLowerCase()) ||
        product.category.toLowerCase().includes(searchText.toLowerCase())
    );

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
        <Card>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0 }}>{t('reports.products.title')}</Title>
                    <Input 
                        placeholder={t('reports.products.search_placeholder')} 
                        prefix={<SearchOutlined />} 
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{ width: 300 }}
                    />
                </div>
                
                <Table
                    columns={columns}
                    dataSource={filteredProducts}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{ 
                        defaultPageSize: 15, 
                        showSizeChanger: true, 
                        pageSizeOptions: ['15', '30', '50', '100'] 
                    }}
                    size="small"
                />
            </Space>

            {selectedProduct && (
                <ProductDetailsModal
                    productId={selectedProduct}
                    visible={isModalVisible}
                    onClose={() => setIsModalVisible(false)}
                />
            )}
        </Card>
    );
};
