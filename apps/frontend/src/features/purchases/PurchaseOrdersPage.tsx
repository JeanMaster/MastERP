import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Row, Col, Card, App, Grid, Typography, Space, Tooltip, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, WhatsAppOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseOrdersApi } from '../../services/purchaseOrdersApi';
import type { PurchaseOrder } from '../../services/purchaseOrdersApi';
import { CreatePurchaseOrderModal } from './components/CreatePurchaseOrderModal';
import { PurchaseOrderDetailsModal } from './components/PurchaseOrderDetailsModal';
import { companySettingsApi } from '../../services/companySettingsApi';

/**
 * PurchaseOrdersPage Component
 * Management dashboard for Supplier Purchase Orders.
 * Allows creating, viewing, and tracking orders, as well as sharing order details via WhatsApp.
 */
export const PurchaseOrdersPage: React.FC = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const { message } = App.useApp();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [detailsVisible, setDetailsVisible] = useState(false);
    const [companyName, setCompanyName] = useState('');

    useEffect(() => {
        fetchOrders();
        fetchCompanyName();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const data = await purchaseOrdersApi.getAll();
            setOrders(data);
        } catch (error) {
            message.error('Error loading purchase orders');
        } finally {
            setLoading(false);
        }
    };

    const fetchCompanyName = async () => {
        try {
            const settings = await companySettingsApi.getSettings();
            setCompanyName(settings.name);
        } catch (error) {
            console.error('Error fetching company name', error);
        }
    };

    /**
     * Deletes a pending purchase order.
     */
    const handleDelete = async (id: string) => {
        try {
            await purchaseOrdersApi.delete(id);
            message.success('Order deleted successfully');
            fetchOrders();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error deleting purchase order');
        }
    };

    /**
     * Formats and shares the order details via WhatsApp to the supplier.
     */
    const handleShareWhatsApp = (order: PurchaseOrder) => {
        const supplierPhone = order.supplier.phone?.replace(/\D/g, '');
        if (!supplierPhone) {
            message.warning('Supplier has no phone number registered');
            return;
        }

        let text = `*Purchase Order from: ${companyName || 'Our Company'}*\n`;
        text += `ID: ${order.id.slice(0, 8)}\n`;
        text += `Date: ${dayjs(order.orderDate).format('MM/DD/YYYY')}\n\n`;
        text += `*Items:*\n`;

        order.items.forEach((item, index) => {
            text += `${index + 1}. ${item.product?.name || 'Product'} - SKU: ${item.product?.sku || 'N/A'}\n`;
            text += `   Qty: ${item.quantity}\n`;
        });

        if (order.notes) {
            text += `\n*Note:* ${order.notes}`;
        }

        const encodedText = encodeURIComponent(text);
        const url = `https://wa.me/${supplierPhone}?text=${encodedText}`;
        window.open(url, '_blank');
    };

    const handleViewDetails = (order: PurchaseOrder) => {
        setSelectedOrder(order);
        setDetailsVisible(true);
    };

    const columns = [
        {
            title: 'Date',
            dataIndex: 'orderDate',
            key: 'date',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY'),
            sorter: (a: PurchaseOrder, b: PurchaseOrder) => dayjs(a.orderDate).unix() - dayjs(b.orderDate).unix(),
        },
        {
            title: 'Supplier',
            dataIndex: ['supplier', 'comercialName'],
            key: 'supplier',
        },
        {
            title: 'Total',
            dataIndex: 'total',
            key: 'total',
            render: (total: number, record: PurchaseOrder) => (
                <span style={{ fontWeight: 500 }}>{record.currencyCode} {Number(total).toFixed(2)}</span>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                let color = 'orange';
                let label = status;
                if (status === 'COMPLETED') { color = 'green'; label = 'Received'; }
                if (status === 'CANCELLED') { color = 'red'; label = 'Cancelled'; }
                if (status === 'PENDING') { color = 'blue'; label = 'Pending'; }
                return <Tag color={color}>{label}</Tag>;
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: isMobile ? false : ('right' as const),
            render: (_: any, record: PurchaseOrder) => (
                <Space>
                    <Tooltip title="View Details">
                        <Button
                            icon={<EyeOutlined />}
                            type="text"
                            onClick={() => handleViewDetails(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Send via WhatsApp">
                        <Button
                            icon={<WhatsAppOutlined />}
                            type="text"
                            style={{ color: '#25D366' }}
                            onClick={() => handleShareWhatsApp(record)}
                        />
                    </Tooltip>
                    {record.status === 'PENDING' && (
                        <Popconfirm
                            title="Delete this order?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button
                                icon={<DeleteOutlined />}
                                type="text"
                                danger
                            />
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: isMobile ? '8px' : '24px' }}>
            <Card>
                <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} md={12}>
                        <Typography.Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>📋 Purchase Orders</Typography.Title>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <Space wrap={isMobile}>
                            <Button icon={<ReloadOutlined />} onClick={fetchOrders} />
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setModalVisible(true)}
                                block={isMobile}
                            >
                                New Order
                            </Button>
                        </Space>
                    </Col>
                </Row>

                <Table
                    columns={columns}
                    dataSource={orders}
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

            <CreatePurchaseOrderModal
                visible={modalVisible}
                onCancel={() => setModalVisible(false)}
                onSuccess={() => {
                    setModalVisible(false);
                    fetchOrders();
                }}
            />

            <PurchaseOrderDetailsModal
                visible={detailsVisible}
                order={selectedOrder}
                onClose={() => setDetailsVisible(false)}
            />
        </div>
    );
};
