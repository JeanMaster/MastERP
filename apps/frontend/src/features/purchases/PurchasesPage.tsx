import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Row, Col, Card, App, Grid, Typography, Space, List } from 'antd';
import { PlusOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { purchasesApi } from '../../services/purchasesApi';
import type { Purchase } from '../../services/purchasesApi';
import { CreatePurchaseModal } from './components/CreatePurchaseModal';
import { PurchaseDetailsModal } from './components/PurchaseDetailsModal';

/**
 * PurchasesPage Component
 * Management interface for inventory reception and purchase history.
 * Lists all registered purchase invoices from suppliers.
 */
export const PurchasesPage: React.FC = () => {
    const { t } = useTranslation();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const { message } = App.useApp();
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false); // For Create Modal
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const [detailsVisible, setDetailsVisible] = useState(false);

    useEffect(() => {
        fetchPurchases();
    }, []);

    const fetchPurchases = async () => {
        setLoading(true);
        try {
            const data = await purchasesApi.getAll();
            setPurchases(data);
        } catch (error) {
            message.error(t('purchases.messages.load_error'));
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (purchase: Purchase) => {
        setSelectedPurchase(purchase);
        setDetailsVisible(true);
    };

    const columns = [
        {
            title: t('purchases.table.date'),
            dataIndex: 'invoiceDate',
            key: 'date',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
            sorter: (a: Purchase, b: Purchase) => dayjs(a.invoiceDate).unix() - dayjs(b.invoiceDate).unix(),
        },
        {
            title: t('purchases.table.supplier'),
            dataIndex: ['supplier', 'comercialName'],
            key: 'supplier',
        },
        {
            title: t('purchases.table.invoice_number'),
            dataIndex: 'invoiceNumber',
            key: 'invoiceNumber',
            render: (text: string) => text || 'N/A',
        },
        {
            title: t('purchases.table.items'),
            dataIndex: 'items',
            key: 'items',
            render: (items: any[]) => items.length,
        },
        {
            title: t('purchases.table.total'),
            dataIndex: 'total',
            key: 'total',
            render: (total: number, record: Purchase) => (
                <span>{record.currencyCode} {Number(total).toFixed(2)}</span>
            ),
        },
        {
            title: t('purchases.table.status'),
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'COMPLETED' ? 'green' : 'orange'}>
                    {status === 'COMPLETED' ? t('purchases.completed') : status}
                </Tag>
            ),
        },
        {
            title: t('purchases.table.actions'),
            key: 'actions',
            width: 80,
            fixed: isMobile ? false : ('right' as const),
            render: (_: any, record: Purchase) => (
                <Button
                    icon={<EyeOutlined />}
                    type="text"
                    onClick={() => handleViewDetails(record)}
                />
            ),
        },
    ];

    return (
        <div style={{ padding: isMobile ? '8px' : '24px' }}>
            <Card>
                <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} md={12}>
                        <Typography.Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>📦 {t('purchases.title')}</Typography.Title>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <Space wrap={isMobile}>
                            <Button icon={<ReloadOutlined />} onClick={fetchPurchases} />
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setModalVisible(true)}
                                block={isMobile}
                            >
                                {t('purchases.register_button')}
                            </Button>
                        </Space>
                    </Col>
                </Row>

                {!isMobile ? (
                    <Table
                        columns={columns}
                        dataSource={purchases}
                        rowKey="id"
                        loading={loading}
                        scroll={{ x: 'max-content' }}
                        size="middle"
                        pagination={{
                            pageSize: 10,
                            responsive: true
                        }}
                    />
                ) : (
                    <List
                        loading={loading}
                        dataSource={purchases}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            size: 'small',
                            simple: true,
                        }}
                        renderItem={(item: Purchase) => (
                            <List.Item
                                onClick={() => handleViewDetails(item)}
                                style={{
                                    padding: '16px',
                                    background: '#fff',
                                    marginBottom: 12,
                                    borderRadius: 16,
                                    border: '1px solid #f0f0f0',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                    display: 'block',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
                                            {item.supplier?.comercialName || 'S/N'}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                                            {dayjs(item.invoiceDate).format('DD/MM/YYYY')}
                                        </div>
                                    </div>
                                    <Tag color={item.status === 'COMPLETED' ? 'green' : 'orange'} style={{ margin: 0 }}>
                                        {item.status === 'COMPLETED' ? t('purchases.completed') : item.status}
                                    </Tag>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: 13, color: '#595959' }}>
                                            <strong>{t('purchases.table.invoice_number')}:</strong> {item.invoiceNumber || 'N/A'}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                                            {item.items.length} {t('purchases.table.items', { defaultValue: 'items' })}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
                                            {item.currencyCode} {Number(item.total).toFixed(2)}
                                        </div>
                                        <EyeOutlined style={{ color: '#1890ff', fontSize: 18, marginTop: 4 }} />
                                    </div>
                                </div>
                            </List.Item>
                        )}
                    />
                )}
            </Card>

            <CreatePurchaseModal
                visible={modalVisible}
                onCancel={() => setModalVisible(false)}
                onSuccess={() => {
                    setModalVisible(false);
                    fetchPurchases();
                }}
            />

            <PurchaseDetailsModal
                visible={detailsVisible}
                purchase={selectedPurchase}
                onClose={() => setDetailsVisible(false)}
            />
        </div>
    );
};
