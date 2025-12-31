import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Row, Col, Card, App, Grid, Typography, Space } from 'antd';
import { PlusOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchasesApi } from '../../services/purchasesApi';
import type { Purchase } from '../../services/purchasesApi';
import { CreatePurchaseModal } from './components/CreatePurchaseModal';
import { PurchaseDetailsModal } from './components/PurchaseDetailsModal';
// No, previously we removed it because App component wraps routes.
// But some pages use it?
// Let's check SuppliersPage. It returns <div>.
// App.tsx wraps routes in MainLayout. So pages should NOT use MainLayout wrapper, just content.
// Confirmed.

export const PurchasesPage: React.FC = () => {
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
            message.error('Error al cargar historial de compras');
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
            title: 'Fecha',
            dataIndex: 'invoiceDate',
            key: 'date',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
            sorter: (a: Purchase, b: Purchase) => dayjs(a.invoiceDate).unix() - dayjs(b.invoiceDate).unix(),
        },
        {
            title: 'Proveedor',
            dataIndex: ['supplier', 'comercialName'],
            key: 'supplier',
        },
        {
            title: '# Factura',
            dataIndex: 'invoiceNumber',
            key: 'invoiceNumber',
            render: (text: string) => text || 'N/A',
        },
        {
            title: 'Items',
            dataIndex: 'items',
            key: 'items',
            render: (items: any[]) => items.length,
        },
        {
            title: 'Total',
            dataIndex: 'total',
            key: 'total',
            render: (total: number, record: Purchase) => (
                <span>{record.currencyCode} {Number(total).toFixed(2)}</span>
            ),
        },
        {
            title: 'Estado',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'COMPLETED' ? 'green' : 'orange'}>
                    {status === 'COMPLETED' ? 'Completado' : status}
                </Tag>
            ),
        },
        {
            title: 'Acciones',
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
                        <Typography.Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>📦 Recepción de Compras</Typography.Title>
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
                                Registrar Compra
                            </Button>
                        </Space>
                    </Col>
                </Row>

                <Table
                    columns={columns}
                    dataSource={purchases}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 'max-content' }}
                    size={isMobile ? 'small' : 'middle'}
                    pagination={{
                        pageSize: 10,
                        size: isMobile ? 'small' : 'default',
                        responsive: true
                    }}
                />
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
