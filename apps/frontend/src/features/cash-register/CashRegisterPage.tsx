import { useState, useEffect } from 'react';
import {
    Card,
    Button,
    Table,
    Statistic,
    Row,
    Col,
    Tag,
    Space,
    Typography,
    Spin,
    Empty,
    Alert,
    Tabs
} from 'antd';
import {
    DollarOutlined,
    ShoppingOutlined,
    BankOutlined,
    LogoutOutlined,
    PlusOutlined,
    ReloadOutlined,
    HistoryOutlined,
    EyeOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { cashRegisterApi, type CashSession, type CashMovement } from '../../services/cashRegisterApi';
import { formatVenezuelanPrice } from '../../utils/formatters';
import dayjs from 'dayjs';
import { OpenSessionModal } from './components/OpenSessionModal';
import { CloseSessionModal } from './components/CloseSessionModal';
import { AddMovementModal } from './components/AddMovementModal';
import { TransferToTreasuryModal } from './components/TransferToTreasuryModal';

const { Title, Text } = Typography;

export const CashRegisterPage = () => {
    const [registerId, setRegisterId] = useState<string>('');
    const [isOpenModalVisible, setIsOpenModalVisible] = useState(false);
    const [isCloseModalVisible, setIsCloseModalVisible] = useState(false);
    const [isAddMovementOpen, setIsAddMovementOpen] = useState(false);
    const [isTransferToTreasuryOpen, setIsTransferToTreasuryOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('current');
    const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

    // Fetch register
    const { data: register } = useQuery({
        queryKey: ['cashRegister'],
        queryFn: () => cashRegisterApi.getMainRegister()
    });

    // Set register ID when loaded
    useEffect(() => {
        if (register) {
            setRegisterId(register.id);
        }
    }, [register]);

    // Fetch active session
    const { data: activeSession, isLoading, refetch } = useQuery({
        queryKey: ['activeSession', registerId],
        queryFn: () => cashRegisterApi.getActiveSession(registerId),
        enabled: !!registerId,
        refetchInterval: 10000 // Refresh every 10 seconds
    });

    // Fetch closed sessions
    const { data: closedSessions = [], refetch: refetchHistory } = useQuery({
        queryKey: ['closedSessions', registerId],
        queryFn: () => cashRegisterApi.listSessions({ status: 'CLOSED' }),
        enabled: !!registerId
    });

    const calculateSummary = (session: CashSession) => {
        let sales = 0;
        let expenses = 0;
        let deposits = 0;
        let withdrawals = 0;

        session.movements.forEach(movement => {
            const amount = Number(movement.amount);
            switch (movement.type) {
                case 'SALE':
                    sales += amount;
                    break;
                case 'EXPENSE':
                    expenses += amount;
                    break;
                case 'DEPOSIT':
                    deposits += amount;
                    break;
                case 'WITHDRAWAL':
                    withdrawals += amount;
                    break;
            }
        });

        const expected = Number(session.openingBalance) + sales + withdrawals - expenses - deposits;

        return { sales, expenses, deposits, withdrawals, expected };
    };

    const getMovementIcon = (type: string) => {
        switch (type) {
            case 'SALE':
                return <ShoppingOutlined style={{ color: '#52c41a' }} />;
            case 'EXPENSE':
                return <DollarOutlined style={{ color: '#ff4d4f' }} />;
            case 'DEPOSIT':
                return <BankOutlined style={{ color: '#1890ff' }} />;
            case 'WITHDRAWAL':
                return <LogoutOutlined style={{ color: '#faad14' }} />;
            case 'OPENING':
                return <PlusOutlined style={{ color: '#722ed1' }} />;
            case 'CLOSING':
                return <LogoutOutlined style={{ color: '#722ed1' }} />;
            default:
                return null;
        }
    };

    const getMovementTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            SALE: 'Venta',
            EXPENSE: 'Gasto',
            DEPOSIT: 'Retiro de Caja',
            WITHDRAWAL: 'Ingreso a Caja',
            OPENING: 'Apertura',
            CLOSING: 'Cierre'
        };
        return labels[type] || type;
    };

    const movementsColumns = [
        {
            title: 'Hora',
            dataIndex: 'createdAt',
            key: 'time',
            width: 80,
            render: (date: string) => dayjs(date).format('HH:mm')
        },
        {
            title: 'Tipo',
            dataIndex: 'type',
            key: 'type',
            width: 120,
            render: (type: string) => (
                <Space>
                    {getMovementIcon(type)}
                    <Text>{getMovementTypeLabel(type)}</Text>
                </Space>
            )
        },
        {
            title: 'Descripción',
            dataIndex: 'description',
            key: 'description'
        },
        {
            title: 'Monto',
            dataIndex: 'amount',
            key: 'amount',
            width: 120,
            align: 'right' as const,
            render: (amount: number, record: CashMovement) => {
                const isPositive = ['SALE', 'WITHDRAWAL', 'OPENING'].includes(record.type);
                return (
                    <Text strong style={{ color: isPositive ? '#52c41a' : '#ff4d4f' }}>
                        {isPositive ? '+' : '-'}{formatVenezuelanPrice(amount)}
                    </Text>
                );
            }
        }
    ];

    const historyColumns = [
        {
            title: 'Fecha',
            key: 'date',
            width: 150,
            render: (_: any, record: CashSession) => (
                <div>
                    <div><strong>{dayjs(record.openedAt).format('DD/MM/YYYY')}</strong></div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                        {dayjs(record.openedAt).format('HH:mm')} - {dayjs(record.closedAt).format('HH:mm')}
                    </div>
                </div>
            )
        },
        {
            title: 'Responsable',
            key: 'user',
            width: 120,
            render: (_: any, record: CashSession) => (
                <div>
                    <div>{record.openedBy}</div>
                    {record.closedBy && record.closedBy !== record.openedBy && (
                        <div style={{ fontSize: 11, color: '#888' }}>Cerró: {record.closedBy}</div>
                    )}
                </div>
            )
        },
        {
            title: 'Apertura',
            dataIndex: 'openingBalance',
            key: 'opening',
            width: 100,
            align: 'right' as const,
            render: (amount: number) => formatVenezuelanPrice(Number(amount))
        },
        {
            title: 'Esperado',
            dataIndex: 'expectedBalance',
            key: 'expected',
            width: 100,
            align: 'right' as const,
            render: (amount: number) => formatVenezuelanPrice(Number(amount || 0))
        },
        {
            title: 'Real',
            dataIndex: 'actualBalance',
            key: 'actual',
            width: 100,
            align: 'right' as const,
            render: (amount: number) => formatVenezuelanPrice(Number(amount || 0))
        },
        {
            title: 'Varianza',
            dataIndex: 'variance',
            key: 'variance',
            width: 100,
            align: 'right' as const,
            render: (variance: number) => {
                const value = Number(variance || 0);
                const color = value === 0 ? '#52c41a' : (value > 0 ? '#faad14' : '#ff4d4f');
                return (
                    <Text strong style={{ color }}>
                        {value >= 0 ? '+' : ''}{formatVenezuelanPrice(value)}
                    </Text>
                );
            }
        }
    ];

    if (isLoading) {
        return (
            <div style={{ padding: 24, textAlign: 'center' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!activeSession) {
        return (
            <div style={{ padding: 24 }}>
                <Title level={2}>🏦 Caja</Title>

                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'current',
                            label: 'Sesión Actual',
                            children: (
                                <Card>
                                    <Empty
                                        description="No hay sesión activa"
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    >
                                        <Button
                                            type="primary"
                                            size="large"
                                            icon={<PlusOutlined />}
                                            onClick={() => setIsOpenModalVisible(true)}
                                        >
                                            Abrir Caja
                                        </Button>
                                    </Empty>
                                </Card>
                            )
                        },
                        {
                            key: 'history',
                            label: (
                                <span>
                                    <HistoryOutlined /> Historial
                                </span>
                            ),
                            children: (
                                <Card>
                                    <Table
                                        dataSource={closedSessions}
                                        columns={historyColumns}
                                        rowKey="id"
                                        expandable={{
                                            expandedRowKeys,
                                            onExpand: (expanded, record) => {
                                                setExpandedRowKeys(expanded ? [record.id] : []);
                                            },
                                            expandedRowRender: (record: CashSession) => (
                                                <div style={{ padding: '0 24px' }}>
                                                    <Title level={5}>Movimientos</Title>
                                                    <Table
                                                        dataSource={record.movements}
                                                        columns={movementsColumns}
                                                        rowKey="id"
                                                        pagination={false}
                                                        size="small"
                                                    />
                                                </div>
                                            ),
                                            expandIcon: ({ expanded, onExpand, record }) => (
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<EyeOutlined />}
                                                    onClick={(e) => onExpand(record, e)}
                                                >
                                                    {expanded ? 'Ocultar' : 'Ver detalles'}
                                                </Button>
                                            )
                                        }}
                                        pagination={{
                                            pageSize: 10,
                                            showTotal: (total) => `Total: ${total} sesiones`
                                        }}
                                    />
                                </Card>
                            )
                        }
                    ]}
                />

                <OpenSessionModal
                    open={isOpenModalVisible}
                    registerId={registerId}
                    onCancel={() => setIsOpenModalVisible(false)}
                    onSuccess={() => {
                        setIsOpenModalVisible(false);
                        refetch();
                    }}
                />
            </div>
        );
    }

    const summary = calculateSummary(activeSession);

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2}>🏦 {activeSession.register.name}</Title>
                <Space>
                    <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
                        ● ABIERTA
                    </Tag>
                    <Text type="secondary">
                        Responsable: <strong>{activeSession.openedBy}</strong>
                    </Text>
                </Space>
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: 'current',
                        label: 'Sesión Actual',
                        children: (
                            <>
                                <Alert
                                    message={`Sesión iniciada: ${dayjs(activeSession.openedAt).format('DD/MM/YYYY HH:mm')}`}
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                />

                                {/* Summary Cards */}
                                <Row gutter={16} style={{ marginBottom: 24 }}>
                                    <Col xs={24} sm={12} md={6}>
                                        <Card>
                                            <Statistic
                                                title="Apertura"
                                                value={Number(activeSession.openingBalance)}
                                                precision={2}
                                                prefix="Bs."
                                                valueStyle={{ color: '#722ed1' }}
                                                styles={{ content: { color: '#722ed1' } }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={6}>
                                        <Card>
                                            <Statistic
                                                title="Ventas"
                                                value={summary.sales}
                                                precision={2}
                                                prefix="Bs."
                                                valueStyle={{ color: '#52c41a' }}
                                                styles={{ content: { color: '#52c41a' } }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={6}>
                                        <Card>
                                            <Statistic
                                                title="Gastos"
                                                value={summary.expenses}
                                                precision={2}
                                                prefix="Bs."
                                                valueStyle={{ color: '#ff4d4f' }}
                                                styles={{ content: { color: '#ff4d4f' } }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12} md={6}>
                                        <Card style={{ borderColor: '#1890ff', borderWidth: 2 }}>
                                            <Statistic
                                                title="Balance Esperado"
                                                value={summary.expected}
                                                precision={2}
                                                prefix="Bs."
                                                valueStyle={{ color: '#1890ff', fontSize: 24 }}
                                                styles={{ content: { color: '#1890ff', fontSize: 24 } }}
                                            />
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Actions */}
                                <Card style={{ marginBottom: 16 }}>
                                    <Space wrap>
                                        <Button
                                            type="primary"
                                            icon={<DollarOutlined />}
                                            onClick={() => setIsAddMovementOpen(true)}
                                        >
                                            Registrar Movimiento
                                        </Button>
                                        <Button
                                            type="primary"
                                            icon={<BankOutlined />}
                                            style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                                            onClick={() => setIsTransferToTreasuryOpen(true)}
                                        >
                                            Trasladar a Tesorería
                                        </Button>
                                        <Button
                                            icon={<ReloadOutlined />}
                                            onClick={() => refetch()}
                                        >
                                            Actualizar
                                        </Button>
                                        <Button
                                            danger
                                            type="primary"
                                            icon={<LogoutOutlined />}
                                            onClick={() => setIsCloseModalVisible(true)}
                                        >
                                            Cerrar Caja
                                        </Button>
                                    </Space>
                                </Card>

                                {/* Movements Table */}
                                <Card title="Movimientos del Día">
                                    <Table
                                        dataSource={activeSession.movements}
                                        columns={movementsColumns}
                                        rowKey="id"
                                        pagination={false}
                                        scroll={{ y: 400 }}
                                    />
                                </Card>
                            </>
                        )
                    },
                    {
                        key: 'history',
                        label: (
                            <span>
                                <HistoryOutlined /> Historial
                            </span>
                        ),
                        children: (
                            <Card
                                extra={
                                    <Button
                                        icon={<ReloadOutlined />}
                                        onClick={() => refetchHistory()}
                                    />
                                }
                            >
                                <Table
                                    dataSource={closedSessions}
                                    columns={historyColumns}
                                    rowKey="id"
                                    expandable={{
                                        expandedRowKeys,
                                        onExpand: (expanded, record) => {
                                            setExpandedRowKeys(expanded ? [record.id] : []);
                                        },
                                        expandedRowRender: (record: CashSession) => (
                                            <div style={{ padding: '0 24px' }}>
                                                <Title level={5}>Movimientos de la Sesión</Title>
                                                <Table
                                                    dataSource={record.movements}
                                                    columns={movementsColumns}
                                                    rowKey="id"
                                                    pagination={false}
                                                    size="small"
                                                />
                                            </div>
                                        ),
                                        expandIcon: ({ expanded, onExpand, record }) => (
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<EyeOutlined />}
                                                onClick={(e) => onExpand(record, e)}
                                            >
                                                {expanded ? 'Ocultar' : 'Ver detalles'}
                                            </Button>
                                        )
                                    }}
                                    pagination={{
                                        pageSize: 10,
                                        showTotal: (total) => `Total: ${total} sesiones`
                                    }}
                                />
                            </Card>
                        )
                    }
                ]}
            />

            {/* Modals */}
            <CloseSessionModal
                open={isCloseModalVisible}
                session={activeSession}
                onCancel={() => setIsCloseModalVisible(false)}
                onSuccess={() => {
                    setIsCloseModalVisible(false);
                    refetch();
                    refetchHistory();
                }}
            />

            <AddMovementModal
                open={isAddMovementOpen}
                sessionId={activeSession.id}
                onCancel={() => setIsAddMovementOpen(false)}
                onSuccess={() => {
                    setIsAddMovementOpen(false);
                    refetch();
                }}
            />

            <TransferToTreasuryModal
                open={isTransferToTreasuryOpen}
                sessionId={activeSession.id}
                onClose={() => {
                    setIsTransferToTreasuryOpen(false);
                    refetch();
                }}
            />
        </div>
    );
};
