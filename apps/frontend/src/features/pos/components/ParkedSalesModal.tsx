import { Modal, Table, Button, Popconfirm, Typography, Space, Tooltip, Badge, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { usePOSStore } from '../../../store/posStore';
import { DeleteOutlined, PlayCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useEffect } from 'react';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface ParkedSalesModalProps {
    open: boolean;
    onCancel: () => void;
    registerId?: string;
}

/**
 * ParkedSalesModal Component
 * Shows list of temporarily saved/parked sales, allows recovering or deleting them.
 * Displays both local (ParkedSales) and backend (Preventa) sales with differentiation.
 */
export const ParkedSalesModal = ({ open, onCancel, registerId }: ParkedSalesModalProps) => {
    const { t } = useTranslation();
    const parkedSales = usePOSStore((state) => state.parkedSales);
    const backendParkedSales = usePOSStore((state) => state.backendParkedSales);
    const recoverParkedSale = usePOSStore((state) => state.recoverParkedSale);
    const deleteParkedSale = usePOSStore((state) => state.deleteParkedSale);
    const primaryCurrency = usePOSStore((state) => state.primaryCurrency);
    const cart = usePOSStore((state) => state.cart);
    const fetchBackendParkedSales = usePOSStore((state) => state.fetchBackendParkedSales);

    // Fetch backend parked sales when modal opens or register changes
    useEffect(() => {
        if (open && registerId) {
            fetchBackendParkedSales(registerId);
        }
    }, [open, registerId, fetchBackendParkedSales]);

    // Combine both local and backend parked sales
    const allParkedSales = [...parkedSales, ...backendParkedSales];

    const handleRecover = (saleId: string) => {
        const currentCartHasItems = cart.length > 0;
        const result = recoverParkedSale(saleId);

        if (result.recovered) {
            if (currentCartHasItems) {
                message.info(t('pos.parked.current_cart_auto_parked'));
            }
            message.success(t('pos.parked.recovered_success'));

            if (result.stockWarnings && result.stockWarnings.length > 0) {
                // Show stock warnings modal or messages
                Modal.warning({
                    title: t('pos.cart.insufficient_stock'),
                    content: (
                        <div style={{ marginTop: 10 }}>
                            <p>{t('pos.cart.insufficient_stock')}:</p>
                            <ul>
                                {result.stockWarnings.map((warning, index) => (
                                    <li key={index} style={{ color: '#ff4d4f' }}>{warning}</li>
                                ))}
                            </ul>
                        </div>
                    ),
                });
            }
            onCancel();
        } else {
            message.error(t('common.error'));
        }
    };

    const columns = [
        {
            title: t('pos.parked.customer'),
            dataIndex: 'activeCustomer',
            key: 'activeCustomer',
            render: (text: string, record: any) => (
                <Space orientation="vertical" size={1}>
                    <Space>
                        <Text strong>{text}</Text>
                        {record.isBackend && (
                            <Badge 
                                count={t('pos.parked.pre_sale_tag') || 'Preventa'} 
                                style={{ backgroundColor: '#722ed1' }} 
                            />
                        )}
                        {!record.isBackend && record.registerId && (
                            <Badge 
                                count={t('pos.parked.local_tag') || 'Local'} 
                                style={{ backgroundColor: '#52c41a' }} 
                            />
                        )}
                    </Space>
                    {record.note && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                            <InfoCircleOutlined style={{ marginRight: 4 }} />
                            {record.note}
                        </Text>
                    )}
                </Space>
            ),
        },
        {
            title: t('common.date') || 'Fecha',
            dataIndex: 'parkedAt',
            key: 'parkedAt',
            render: (dateStr: string) => {
                const date = dayjs(dateStr);
                return (
                    <Tooltip title={date.format('YYYY-MM-DD HH:mm:ss')}>
                        <Text>{date.fromNow()}</Text>
                    </Tooltip>
                );
            },
        },
        {
            title: t('pos.footer.items') || 'Artículos',
            dataIndex: ['totals', 'itemsCount'],
            key: 'itemsCount',
            align: 'center' as const,
            render: (count: number) => (
                <Badge 
                    count={count} 
                    showZero 
                    overflowCount={999}
                    style={{ backgroundColor: '#52c41a' }} 
                />
            ),
        },
        {
            title: t('pos.parked.total'),
            dataIndex: ['totals', 'total'],
            key: 'total',
            align: 'right' as const,
            render: (total: number) => (
                <Text strong style={{ color: '#1890ff' }}>
                    {formatVenezuelanPrice(total, primaryCurrency?.symbol || 'Bs.', 2, false)}
                </Text>
            ),
        },
        {
            title: t('common.actions') || 'Acciones',
            key: 'actions',
            align: 'center' as const,
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleRecover(record.id)}
                        style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                    >
                        {t('pos.parked.recover')}
                    </Button>
                    <Popconfirm
                        title={t('pos.parked.delete_confirm_title')}
                        description={t('pos.parked.delete_confirm_desc')}
                        onConfirm={() => {
                            deleteParkedSale(record.id);
                            message.success(t('common.success'));
                        }}
                        okText={t('common.yes') || 'Sí'}
                        cancelText={t('common.no') || 'No'}
                        okButtonProps={{ danger: true }}
                    >
                        <Button
                            type="primary"
                            danger
                            icon={<DeleteOutlined />}
                        />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Modal
            title={
                <Space>
                    <span>{t('pos.parked.parked_sales')}</span>
                    <Badge count={allParkedSales.length} style={{ backgroundColor: '#1890ff' }} />
                </Space>
            }
            open={open}
            onCancel={onCancel}
            footer={[
                <Button key="close" onClick={onCancel}>
                    {t('common.close')}
                </Button>
            ]}
            width={900}
        >
            <Table
                dataSource={allParkedSales}
                columns={columns}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                locale={{
                    emptyText: t('pos.parked.no_parked_sales')
                }}
                style={{ marginTop: 15 }}
            />
        </Modal>
    );
};
