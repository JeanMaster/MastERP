import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Row, Col, Card, App, Grid, Typography, Space, Tooltip, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, WhatsAppOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { purchaseOrdersApi } from '../../services/purchaseOrdersApi';
import type { PurchaseOrder } from '../../services/purchaseOrdersApi';
import { CreatePurchaseOrderModal } from './components/CreatePurchaseOrderModal';
import { PurchaseOrderDetailsModal } from './components/PurchaseOrderDetailsModal';
import { companySettingsApi } from '../../services/companySettingsApi';

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
            message.error('Error al cargar pedidos');
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

    const handleDelete = async (id: string) => {
        try {
            await purchaseOrdersApi.delete(id);
            message.success('Pedido eliminado');
            fetchOrders();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al eliminar pedido');
        }
    };

    const handleShareWhatsApp = (order: PurchaseOrder) => {
        const supplierPhone = order.supplier.phone?.replace(/\D/g, ''); // Remove non-digits
        if (!supplierPhone) {
            message.warning('El proveedor no tiene teléfono registrado');
            return;
        }

        let text = `*Pedido de: ${companyName || 'Nuestra Empresa'}*\n`;
        text += `ID: ${order.id.slice(0, 8)}\n`;
        text += `Fecha: ${dayjs(order.orderDate).format('DD/MM/YYYY')}\n\n`;
        text += `*Artículos:*\n`;

        order.items.forEach((item, index) => {
            text += `${index + 1}. ${item.product?.name || 'Producto'} - SKU: ${item.product?.sku || 'N/A'}\n`;
            text += `   Cant: ${item.quantity}\n`;
        });

        if (order.notes) {
            text += `\n*Nota:* ${order.notes}`;
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
            title: 'Fecha',
            dataIndex: 'orderDate',
            key: 'date',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
            sorter: (a: PurchaseOrder, b: PurchaseOrder) => dayjs(a.orderDate).unix() - dayjs(b.orderDate).unix(),
        },
        {
            title: 'Proveedor',
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
            title: 'Estado',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                let color = 'orange';
                let label = status;
                if (status === 'COMPLETED') { color = 'green'; label = 'Recibido'; }
                if (status === 'CANCELLED') { color = 'red'; label = 'Cancelado'; }
                if (status === 'PENDING') { color = 'blue'; label = 'Pendiente'; }
                return <Tag color={color}>{label}</Tag>;
            },
        },
        {
            title: 'Acciones',
            key: 'actions',
            fixed: isMobile ? false : ('right' as const),
            render: (_: any, record: PurchaseOrder) => (
                <Space>
                    <Tooltip title="Ver Detalles">
                        <Button
                            icon={<EyeOutlined />}
                            type="text"
                            onClick={() => handleViewDetails(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Enviar por WhatsApp">
                        <Button
                            icon={<WhatsAppOutlined />}
                            type="text"
                            style={{ color: '#25D366' }}
                            onClick={() => handleShareWhatsApp(record)}
                        />
                    </Tooltip>
                    {record.status === 'PENDING' && (
                        <Popconfirm
                            title="¿Eliminar pedido?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Sí"
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
                        <Typography.Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>📋 Pedidos a Proveedores</Typography.Title>
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
                                Nuevo Pedido
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
