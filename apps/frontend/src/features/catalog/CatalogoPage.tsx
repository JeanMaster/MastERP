import { useState, useEffect, useMemo } from 'react';
import {
  Card, Form, Select, Button, Table, Space, Typography, Spin, Empty, message, Grid,
} from 'antd';
import {
    WhatsAppOutlined, DownloadOutlined, ShopOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { catalogoApi, type CatalogProduct, type CatalogCurrency } from '../../services/catalogoApi';
import { api } from '../../services/apiConfig';
import { departmentsApi, type Department } from '../../services/departmentsApi';
import { formatVenezuelanPrice } from '../../utils/formatters';

const { Title, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

export const CatalogoPage = () => {
    const { t } = useTranslation();
    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    const [currencies, setCurrencies] = useState<CatalogCurrency[]>([]);
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [sendLoading, setSendLoading] = useState(false);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [form] = Form.useForm();

    // Category filter state
    const [categories, setCategories] = useState<Department[]>([]);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

    useEffect(() => {
        catalogoApi.getCatalogData('VES').then((data) => {
            setProducts(data);
        }).catch(() => message.error(t('settings.company.messages.error_update')));

        catalogoApi.downloadPdf('VES').catch(() => message.error(t('settings.company.messages.error_update')))
          .then(() => {}); // no-op — just to satisfy catch
    }, []);

    // Fetch currencies for selector (authenticated)
    useEffect(() => {
    api.get('/currencies')
      .then((r) => {
        setCurrencies(r.data);
        // Default to primary currency if available
        const primary = r.data.find((c: CatalogCurrency) => c.isPrimary);
        if (primary && selectedCurrency === 'VES') {
          setSelectedCurrency(primary.code);
        }
      })
      .catch(() => {});
    }, []);

    // Load top-level categories (departments without parent)
    useEffect(() => {
      departmentsApi.getAll()
        .then((all) => {
          const topLevel = all.filter((d) => !d.parentId && d.active);
          setCategories(topLevel);
        })
        .catch(() => {});
    }, []);

    // Reload products when currency or category filter changes
    const effectiveCategoryIds = selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined;

    useEffect(() => {
        setLoading(true);
        catalogoApi
          .getCatalogData(selectedCurrency, effectiveCategoryIds)
          .then(setProducts)
          .finally(() => setLoading(false));
    }, [selectedCurrency, selectedCategoryIds]);

    const handleDownloadPdf = async () => {
        try {
            const blob = await catalogoApi.downloadPdf(selectedCurrency, effectiveCategoryIds);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `catalogo-${selectedCurrency}-${new Date().toISOString().slice(0, 10)}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            message.success(t('catalog.messages.download_success'));
        } catch {
            message.error(t('catalog.messages.download_error'));
        }
    };

    const handleSendWhatsApp = async () => {
        if (!whatsappPhone.trim()) {
            message.warning(t('catalog.messages.whatsapp_phone_required'));
            return;
        }
        setSendLoading(true);
        try {
            const pdfBlob = await catalogoApi.downloadPdf(selectedCurrency, effectiveCategoryIds);
            const pdfBase64 = await blobToBase64(pdfBlob);
            await catalogoApi.sendWhatsApp(whatsappPhone, selectedCurrency, pdfBase64, effectiveCategoryIds);
            message.success(t('catalog.messages.whatsapp_sent'));
            setWhatsappPhone('');
        } catch {
            message.error(t('catalog.messages.whatsapp_error'));
        } finally {
            setSendLoading(false);
        }
    };

    /** Convert a Blob to a base64 data-URL string for transport */
    const blobToBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    // ── price display helper ──
    const displayPrice = (p: CatalogProduct) => {
        const curr = currencies.find((c) => c.code === selectedCurrency);
        return formatVenezuelanPrice(
            p.roundedPrice,
            curr?.symbol || selectedCurrency,
            0,
        );
    };

    const primaryCurrency = useMemo(
        () => currencies.find((c) => c.isPrimary) || currencies[0],
        [currencies],
    );

    const columns = [
        {
            title: '#',
            dataIndex: 'index',
            key: 'index',
            width: isMobile ? 40 : 50,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: t('catalog.table.product'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: CatalogProduct) => (
                <div>
                    <Text strong>{text}</Text>
                    {record.sku && (
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                            SKU: {record.sku}
                        </Text>
                    )}
                </div>
            ),
        },
        {
            title: t('catalog.table.category'),
            key: 'category',
            width: 140,
            hidden: isMobile,
            render: (_: any, record: CatalogProduct) => record.category?.name || '-',
        },
        {
            title: t('catalog.table.department'),
            key: 'department',
            width: 140,
            hidden: isMobile,
            render: (_: any, record: CatalogProduct) => record.department?.name || '-',
        },
        {
            title: t('catalog.table.price'),
            key: 'price',
            width: 130,
            align: 'right' as const,
            render: (_: any, record: CatalogProduct) => (
                <Text strong style={{ color: '#1B75BC', fontFamily: 'monospace', fontSize: 14 }}>
                    {displayPrice(record)}
                </Text>
            ),
        },
        {
            title: t('catalog.table.stock'),
            dataIndex: 'stock',
            key: 'stock',
            width: 80,
            align: 'right' as const,
            render: (stock: number) => (
                <Text style={{ color: stock > 0 ? '#2E7D32' : '#CC0000', fontWeight: 600 }}>
                    {stock}
                </Text>
            ),
        },
        {
            title: t('catalog.table.status'),
            dataIndex: 'stock',
            key: 'status',
            width: 100,
            align: 'right' as const,
            render: (stock: number) => (
                <Text style={{
                    color: stock > 0 ? '#2E7D32' : '#CC0000',
                    background: stock > 0 ? '#E8F5E9' : '#FFEBEE',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                }}>
                    {stock > 0 ? t('catalog.status.available') : t('catalog.status.out_of_stock')}
                </Text>
            ),
        },
    ].filter((col) => !col.hidden);

    return (
        <div style={{ padding: isMobile ? 12 : 24 }}>
            <Card
                bordered={false}
                style={{
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    marginBottom: 16,
                }}
            >
                <div style={{ marginBottom: 20 }}>
                    <Title level={2} style={{ margin: 0 }}>
                        <ShopOutlined style={{ color: '#1B75BC' }} />{' '}
                        {t('catalog.page_title')}
                    </Title>
                    <Text type="secondary">{t('catalog.page_subtitle')}</Text>
                </div>

                {/* Controls row */}
                <Space size="middle" wrap style={{ marginBottom: 16 }}>
                    <Form layout="inline" form={form} initialValues={{ currency: 'VES' }}>
                         <Form.Item
                            label={t('catalog.currency_label')}
                            name="currency"
                        >
                            <Select
                                value={selectedCurrency}
                                onChange={(val) => setSelectedCurrency(val)}
                                style={{ minWidth: 200 }}
                                placeholder={t('catalog.select_currency')}
                            >
                                {currencies.map((c) => (
                                    <Option key={c.id} value={c.code}>
                                        {c.name} ({c.symbol})
                                        {c.isPrimary && ` — ${t('catalog.primary')}`}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item label={t('catalog.categories_label')}>
                            <Select
                                mode="multiple"
                                allowClear
                                placeholder={t('catalog.all_categories')}
                                style={{ minWidth: 260 }}
                                value={selectedCategoryIds}
                                onChange={setSelectedCategoryIds}
                                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                            />
                        </Form.Item>
                    </Form>

                    <div style={{ marginLeft: 'auto' }}>
                        <Space>
                            <Button
                                icon={<WhatsAppOutlined />}
                                type="default"
                                onClick={() => {
                                    const phone = primaryCurrency?.code ? '+58' : '+1';
                                    setWhatsappPhone(phone);
                                    setSendLoading(true);
                                    handleSendWhatsApp().then(() => setSendLoading(false));
                                }}
                                style={{ borderRadius: 8 }}
                                loading={sendLoading}
                            >
                                {t('catalog.send_whatsapp')}
                            </Button>
                            <Button
                                icon={<DownloadOutlined />}
                                type="primary"
                                onClick={handleDownloadPdf}
                                style={{ borderRadius: 8 }}
                                loading={loading}
                            >
                                {t('catalog.download_pdf')}
                            </Button>
                        </Space>
                    </div>
                </Space>

                {/* WhatsApp Send Row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: 12,
                    alignItems: 'center',
                    marginBottom: 16,
                    padding: 16,
                    background: '#F0F7FF',
                    borderRadius: 8,
                    border: '1px solid #1B75BC30',
                }}>
                    <div>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            {t('catalog.whatsapp_hint')}
                        </Text>
                    </div>
                    <Select
                        value={whatsappPhone}
                        onChange={setWhatsappPhone}
                        placeholder={t('catalog.whatsapp_placeholder')}
                        style={{ width: 240 }}
                        options={[
                            { label: '+58 412 000-0000 (Venezuela)', value: '+58' },
                            { label: '+1 234 567-8900 (EEUU)', value: '+1' },
                        ]}
                    />
                    <Button
                        icon={<WhatsAppOutlined />}
                        onClick={handleSendWhatsApp}
                        loading={sendLoading}
                        style={{
                            borderRadius: 8,
                            backgroundColor: '#25D366',
                            borderColor: '#25D366',
                            color: '#fff',
                        }}
                        disabled={!whatsappPhone}
                    >
                        {t('catalog.send_to_whatsapp')}
                    </Button>
                </div>

                {/* Product Table */}
                <Spin spinning={loading} tip={t('catalog.messages.loading')}>
                    <Table<CatalogProduct>
                        columns={columns}
                        dataSource={products}
                        rowKey="id"
                        pagination={{
                            defaultPageSize: 20,
                            pageSizeOptions: ['10', '20', '50', '100'],
                            showSizeChanger: true,
                            showTotal: (total, range) =>
                                `${range[0]}-${range[1]} ${t('catalog.table.of')} ${total}`,
                        }}
                        summary={() => (
                            <Table.Summary fixed>
                                <Table.Summary.Row>
                                    <Table.Summary.Cell index={0} colSpan={4}>
                                        <Text strong>{t('catalog.total_products')}</Text>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={1}>
                                        <Text strong style={{ color: '#1B75BC' }}>
                                            {products.length}
                                        </Text>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={2} colSpan={2}>
                                        <Text strong style={{ color: '#2E7D32' }}>
                                            {products.filter((p) => p.stock > 0).length} {t('catalog.in_stock')}
                                        </Text>
                                    </Table.Summary.Cell>
                                </Table.Summary.Row>
                            </Table.Summary>
                        )}
                        locale={{
                            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('catalog.messages.no_products')} />,
                        }}
                        scroll={{ x: 700 }}
                    />
                 </Spin>
             </Card>
         </div>
     );
 };

export default CatalogoPage;
