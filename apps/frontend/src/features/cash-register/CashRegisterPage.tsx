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
    Tabs,
    message
} from 'antd';
import {
    PlusOutlined,
    ReloadOutlined,
    HistoryOutlined,
    SettingOutlined,
    CheckCircleOutlined,
    DollarOutlined,
    BankOutlined,
    LogoutOutlined,
    EyeOutlined,
    ShopOutlined,
    InboxOutlined,
    UndoOutlined
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cashRegisterApi, type CashSession, type CashMovement, type CashRegister } from '../../services/cashRegisterApi';
import { formatVenezuelanPrice } from '../../utils/formatters';
import dayjs from 'dayjs';
import { useAuth } from '../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { OpenSessionModal } from './components/OpenSessionModal';
import { CloseSessionModal } from './components/CloseSessionModal';
import { AddMovementModal } from './components/AddMovementModal';
import { TransferToTreasuryModal } from './components/TransferToTreasuryModal';
import { CashCountModal } from './components/CashCountModal';
import { RegistersManagement } from './RegistersManagement';

const { Title, Text } = Typography;

export const CashRegisterPage = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [registerId, setRegisterId] = useState<string>('');
    const [isOpenModalVisible, setIsOpenModalVisible] = useState(false);
    const [isCloseModalVisible, setIsCloseModalVisible] = useState(false);
    const [isAddMovementOpen, setIsAddMovementOpen] = useState(false);
    const [isTransferToTreasuryOpen, setIsTransferToTreasuryOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('current');
    const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

    // Fetch registers list for dashboard
    const { data: registers = [], isLoading: isLoadingRegisters, refetch: refetchRegisters } = useQuery({
        queryKey: ['cashRegistersDashboard'],
        queryFn: () => cashRegisterApi.listRegisters()
    });

    // Fetch main register initially
    const { data: mainRegister } = useQuery({
        queryKey: ['cashRegisterMain'],
        queryFn: () => cashRegisterApi.getMainRegister()
    });

    // Set initial register ID for non-admin users only if not set
    useEffect(() => {
        if (user?.role === 'CASHIER' && mainRegister && !registerId) {
            setRegisterId(mainRegister.id);
        }
    }, [mainRegister, user]);

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
        queryFn: () => cashRegisterApi.listSessions({ status: 'CLOSED', registerId }),
        enabled: !!registerId
    });

    // Redirect Cashiers to POS if session is already verified
    useEffect(() => {
        if (user?.role === 'CASHIER' && activeSession?.verifiedAt) {
            navigate('/app/sales/pos', { replace: true });
        }
    }, [user, activeSession, navigate]);

    const parsePaymentMethods = (methodStr: string, totalAmount: number): Record<string, number> => {
        const result: Record<string, number> = {};
        if (!methodStr) return result;

        const parts = methodStr.split(', ');
        parts.forEach(part => {
            if (part.includes(':')) {
                const [method, amountStr] = part.split(':');
                result[method.trim()] = (result[method.trim()] || 0) + parseFloat(amountStr);
            } else {
                // If it's a simple method without amount, assume it takes the rest or the total if it's the only one
                // But in this system, multi-method usually always includes amounts.
                result[part.trim()] = (result[part.trim()] || 0) + totalAmount;
            }
        });
        return result;
    };

    const calculateSummary = (session: CashSession) => {
        let sales = 0;
        let expenses = 0;
        let deposits = 0;
        let withdrawals = 0;
        const methodsBreakdown: Record<string, number> = {
            CASH: 0,
            CURRENCY_USD: 0,
            DEBIT: 0,
            MOBILE: 0,
            TRANSFER: 0,
            CREDIT: 0
        };

        // Aggregrate from movements (Physical Cash/USD)
        session.movements.forEach(movement => {
            const amountInBs = Number(movement.amount) * Number(movement.exchangeRate || 1);
            switch (movement.type) {
                case 'SALE':
                    sales += amountInBs;
                    break;
                case 'EXPENSE':
                    expenses += amountInBs;
                    break;
                case 'DEPOSIT':
                    deposits += amountInBs;
                    break;
                case 'WITHDRAWAL':
                    withdrawals += amountInBs;
                    break;
                case 'CHANGE':
                    sales -= amountInBs;
                    break;
                case 'ADJUSTMENT':
                    if (amountInBs > 0) withdrawals += amountInBs;
                    else deposits += Math.abs(amountInBs);
                    break;
            }
        });

        // Aggregate ALL methods from Sales
        session.sales?.forEach(sale => {
            const saleMethods = parsePaymentMethods(sale.paymentMethod, Number(sale.total));
            Object.entries(saleMethods).forEach(([method, amount]) => {
                methodsBreakdown[method] = (methodsBreakdown[method] || 0) + amount;
            });
        });

        const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

        const expected = round(Number(session.openingBalance) + sales + withdrawals - expenses - deposits);

        // Also round the breakdown amounts
        Object.keys(methodsBreakdown).forEach(key => {
            methodsBreakdown[key] = round(methodsBreakdown[key]);
        });

        return {
            sales: round(sales),
            expenses: round(expenses),
            deposits: round(deposits),
            withdrawals: round(withdrawals),
            expected,
            methodsBreakdown
        };
    };

    const getMovementIcon = (type: string) => {
        switch (type) {
            case 'SALE':
                return <ShopOutlined style={{ color: '#52c41a' }} />;
            case 'EXPENSE':
                return <DollarOutlined style={{ color: '#ff4d4f' }} />;
            case 'DEPOSIT':
                return <BankOutlined style={{ color: '#1890ff' }} />;
            case 'WITHDRAWAL':
                return <LogoutOutlined style={{ color: '#faad14' }} />;
            case 'CLOSING':
                return <LogoutOutlined style={{ color: '#722ed1' }} />;
            case 'ADJUSTMENT':
                return <SettingOutlined style={{ color: '#faad14' }} />;
            case 'CHANGE':
                return <UndoOutlined style={{ color: '#ff4d4f' }} />;
            default:
                return null;
        }
    };

    const getMovementTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            SALE: 'Sale',
            EXPENSE: 'Expense',
            DEPOSIT: 'Cash Withdrawal',
            WITHDRAWAL: 'Cash Deposit',
            OPENING: 'Opening',
            CLOSING: 'Closing',
            ADJUSTMENT: 'Cash Adjustment',
            CHANGE: 'Change Given'
        };
        return labels[type] || type;
    };

    const i18nPaymentMethod = (method: string) => {
        const labels: Record<string, string> = {
            CASH: 'Cash Bs',
            CURRENCY_USD: 'Cash $',
            DEBIT: 'Debit Card',
            MOBILE: 'Mobile Payment',
            TRANSFER: 'Transfer',
            CREDIT: 'Credit',
            CURRENCY_UDT: 'Other'
        };
        return labels[method] || method;
    };

    const movementsColumns = [
        {
            title: 'Time',
            dataIndex: 'createdAt',
            key: 'time',
            width: 80,
            render: (date: string) => dayjs(date).format('HH:mm')
        },
        {
            title: 'Type',
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
            title: 'Description',
            dataIndex: 'description',
            key: 'description'
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            width: 140,
            align: 'right' as const,
            render: (amount: number, record: CashMovement) => {
                const isPositive = ['SALE', 'WITHDRAWAL', 'OPENING', 'ADJUSTMENT'].includes(record.type) && amount >= 0;
                // If it's an adjustment but the amount is negative, it will show red.
                const color = isPositive ? '#52c41a' : '#ff4d4f';

                if (record.currencyCode && record.currencyCode !== 'VES') {
                    const amountInBs = amount * (record.exchangeRate || 1);
                    return (
                        <Space direction="vertical" align="end" size={0}>
                            <Text strong style={{ color }}>
                                {isPositive ? '+' : '-'}{formatVenezuelanPrice(amount, record.currencyCode === 'USD' ? '$' : record.currencyCode)}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                {isPositive ? '+' : '-'}{formatVenezuelanPrice(amountInBs)}
                            </Text>
                        </Space>
                    );
                }

                return (
                    <Text strong style={{ color }}>
                        {isPositive ? '+' : '-'}{formatVenezuelanPrice(amount)}
                    </Text>
                );
            }
        }
    ];

    const historyColumns = [
        {
            title: 'Date',
            key: 'date',
            width: 150,
            render: (_: any, record: CashSession) => (
                <div>
                    <div><strong>{dayjs(record.openedAt).format('MM/DD/YYYY')}</strong></div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                        {dayjs(record.openedAt).format('HH:mm')} - {record.closedAt ? dayjs(record.closedAt).format('HH:mm') : '-'}
                    </div>
                </div>
            )
        },
        {
            title: 'Responsible',
            key: 'user',
            width: 120,
            render: (_: any, record: CashSession) => (
                <div>
                    <div>{record.openedBy}</div>
                    {record.closedBy && record.closedBy !== record.openedBy && (
                        <div style={{ fontSize: 11, color: '#888' }}>Closed by: {record.closedBy}</div>
                    )}
                </div>
            )
        },
        {
            title: 'Opening',
            dataIndex: 'openingBalance',
            key: 'opening',
            width: 100,
            align: 'right' as const,
            render: (amount: number) => formatVenezuelanPrice(Number(amount))
        },
        {
            title: 'Expected',
            dataIndex: 'expectedBalance',
            key: 'expected',
            width: 100,
            align: 'right' as const,
            render: (amount: number) => formatVenezuelanPrice(Number(amount || 0))
        },
        {
            title: 'Actual',
            dataIndex: 'actualBalance',
            key: 'actual',
            width: 100,
            align: 'right' as const,
            render: (amount: number) => formatVenezuelanPrice(Number(amount || 0))
        },
        {
            title: 'Variance',
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

    const getStatusTag = (status: string) => {
        switch (status) {
            case 'OPEN':
                return <Tag color="green" style={{ fontSize: 13, padding: '2px 8px' }}>● OPEN</Tag>;
            case 'AWAITING_CLOSE':
                return <Tag color="warning" style={{ fontSize: 13, padding: '2px 8px' }}>● AWAITING CLOSE</Tag>;
            case 'CLOSED':
                return <Tag color="default" style={{ fontSize: 13, padding: '2px 8px' }}>● CLOSED</Tag>;
            default:
                return <Tag>{status}</Tag>;
        }
    };

    const handleOpenRegister = (id: string) => {
        setRegisterId(id);
        setIsOpenModalVisible(true);
    };

    const handleSelectRegister = (id: string) => {
        setRegisterId(id);
        setActiveTab('current');
    };

    const handleApproveClose = async (sessionId: string) => {
        try {
            await cashRegisterApi.approveClose(sessionId, user?.username || 'Admin');
            message.success('Cash close authorized successfully');
            refetch();
            refetchHistory();
            refetchRegisters();
        } catch (error: any) {
            message.error(error.message || 'Error authorizing close');
        }
    };

    const registerColumns = [
        {
            title: 'Cash Register Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: CashRegister) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{text}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{record.location}</Text>
                </Space>
            )
        },
        {
            title: 'Status',
            key: 'status',
            render: (_: any, record: CashRegister) => (
                record.activeSession
                    ? getStatusTag(record.activeSession.status)
                    : <Tag color="default">● CLOSED</Tag>
            )
        },
        {
            title: 'Responsible',
            key: 'manager',
            render: (_: any, record: CashRegister) => (
                record.activeSession?.cashierId || record.activeSession?.openedBy || '-'
            )
        },
        {
            title: 'Cash in Drawer',
            key: 'balance',
            align: 'right' as const,
            render: (_: any, record: CashRegister) => (
                record.activeSession
                    ? <Text strong style={{ color: '#1890ff', fontSize: 16 }}>{formatVenezuelanPrice(record.activeSession.currentBalance)}</Text>
                    : '-'
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: CashRegister) => (
                <Space>
                    {!record.activeSession ? (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => handleOpenRegister(record.id)}
                        >
                            Open
                        </Button>
                    ) : (
                        <>
                            <Button
                                icon={<EyeOutlined />}
                                onClick={() => handleSelectRegister(record.id)}
                            >
                                View Details
                            </Button>
                            <Button
                                type="primary"
                                icon={<BankOutlined />}
                                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                                onClick={() => {
                                    setRegisterId(record.id);
                                    setIsTransferToTreasuryOpen(true);
                                }}
                            >
                                Treasury
                            </Button>
                            <Button
                                danger
                                type="primary"
                                icon={<LogoutOutlined />}
                                onClick={() => {
                                    setRegisterId(record.id);
                                    setIsCloseModalVisible(true);
                                }}
                            >
                                Close
                            </Button>
                        </>
                    )}
                </Space>
            )
        }
    ];

    const renderCashCountTable = (counts: any[]) => {
        if (!counts || counts.length === 0) return <Empty description="No cash breakdown reported" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

        const vesItems = counts.filter(c => c.currencyCode === 'VES');
        const usdItems = counts.filter(c => c.currencyCode === 'USD');

        const columns = [
            { title: 'Denomination', dataIndex: 'value', key: 'value', render: (val: any, record: any) => `${Number(val).toFixed(2)} ${record.currencyCode}` },
            { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', align: 'center' as const },
            { title: 'Subtotal', dataIndex: 'total', key: 'total', align: 'right' as const, render: (val: any, record: any) => `${Number(val).toFixed(2)} ${record.currencyCode}` },
        ];

        return (
            <Row gutter={24}>
                <Col span={12}>
                    <Title level={5}>VES (Bolívares)</Title>
                    <Table
                        dataSource={vesItems}
                        columns={columns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        footer={() => (
                            <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                Total VES: {vesItems.reduce((acc, curr) => acc + Number(curr.total), 0).toFixed(2)} Bs.
                            </div>
                        )}
                    />
                </Col>
                <Col span={12}>
                    <Title level={5}>USD (Dollars)</Title>
                    <Table
                        dataSource={usdItems}
                        columns={columns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        footer={() => (
                            <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                Total USD: {usdItems.reduce((acc, curr) => acc + Number(curr.total), 0).toFixed(2)} $
                            </div>
                        )}
                    />
                </Col>
            </Row>
        );
    };

    const renderCurrentTab = () => {
        if (isLoadingRegisters || (registerId && isLoading)) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;

        // If a specific register is selected AND it has an active session, show detailed view
        if (registerId && activeSession) {
            const summary = calculateSummary(activeSession);
            return (
                <>
                    <Button
                        icon={<HistoryOutlined />}
                        onClick={() => setRegisterId('')}
                        style={{ marginBottom: 16 }}
                    >
                        Back to Registers Panel
                    </Button>

                    {activeSession.status === 'AWAITING_CLOSE' ? (
                        <Alert
                            message={<Title level={4} style={{ margin: 0, color: '#856404' }}>📢 {activeSession.register.name.toUpperCase()} REQUESTS CLOSE</Title>}
                            description={
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Text>The cashier has completed the count and requests to close the session. Review the amounts before authorizing.</Text>
                                    <div style={{ marginTop: 8 }}>
                                        <Text strong>Counted by Cashier: {formatVenezuelanPrice(Number(activeSession.actualBalance))}</Text>
                                        <br />
                                        <Text type="secondary">Reported variance: {formatVenezuelanPrice(Number(activeSession.variance))}</Text>
                                    </div>
                                    <Button
                                        type="primary"
                                        icon={<CheckCircleOutlined />}
                                        style={{ marginTop: 12, backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                                        onClick={() => handleApproveClose(activeSession.id)}
                                    >
                                        Authorize Cash Close
                                    </Button>
                                </Space>
                            }
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                    ) : (
                        <Alert
                            message={`Session started: ${dayjs(activeSession.openedAt).format('MM/DD/YYYY HH:mm')}`}
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                    )}

                    {/* Summary Cards */}
                    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col xs={24} sm={12} md={6}>
                            <Card>
                                <Statistic
                                    title="Opening"
                                    value={Number(activeSession.openingBalance)}
                                    precision={2}
                                    prefix="Bs."
                                    valueStyle={{ color: '#722ed1' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Card>
                                <Statistic
                                    title="Total Sales"
                                    value={activeSession.sales?.reduce((acc, curr) => acc + Number(curr.total), 0) || 0}
                                    precision={2}
                                    prefix="Bs."
                                    valueStyle={{ color: '#52c41a' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Card>
                                <Statistic
                                    title="Expenses / Withdrawals"
                                    value={summary.expenses + summary.deposits}
                                    precision={2}
                                    prefix="Bs."
                                    valueStyle={{ color: '#ff4d4f' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Card style={{ borderColor: '#1890ff', borderWidth: 2 }}>
                                <Statistic
                                    title="Cash in Drawer (Expected)"
                                    value={summary.expected}
                                    precision={2}
                                    prefix="Bs."
                                    valueStyle={{ color: '#1890ff', fontSize: 24 }}
                                />
                            </Card>
                        </Col>
                    </Row>

                    {/* Payment Pillar Breakdown */}
                    <Card title="Payment Method Summary" style={{ marginBottom: 24 }}>
                        <Row gutter={[16, 16]}>
                            {Object.entries(summary.methodsBreakdown).map(([method, amount]) => (
                                amount > 0 && (
                                    <Col xs={12} sm={8} md={4} key={method}>
                                        <Statistic
                                            title={i18nPaymentMethod(method)}
                                            value={amount}
                                            precision={2}
                                            valueStyle={{ fontSize: 16 }}
                                            prefix="Bs."
                                        />
                                    </Col>
                                )
                            ))}
                        </Row>
                    </Card>

                    {/* Actions */}
                    <Card style={{ marginBottom: 16 }}>
                        <Space wrap>
                            <Button
                                type="primary"
                                icon={<DollarOutlined />}
                                onClick={() => setIsAddMovementOpen(true)}
                            >
                                Register Movement
                            </Button>
                            <Button
                                type="primary"
                                icon={<BankOutlined />}
                                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                                onClick={() => setIsTransferToTreasuryOpen(true)}
                            >
                                Transfer to Treasury
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => refetch()}
                            >
                                Update
                            </Button>
                            <Button
                                danger
                                type="primary"
                                icon={<LogoutOutlined />}
                                onClick={() => setIsCloseModalVisible(true)}
                            >
                                Close Cash
                            </Button>
                        </Space>
                    </Card>

                    {/* Reported Cash Details */}
                    {activeSession?.cashCounts && activeSession.cashCounts.length > 0 && (
                        <Card title={<Space><InboxOutlined /> Cash Count Reported by Cashier</Space>} style={{ marginBottom: 24 }}>
                            <Tabs
                                type="card"
                                items={[
                                    {
                                        key: 'closing',
                                        label: 'Closing Count',
                                        children: renderCashCountTable(activeSession.cashCounts.filter(c => c.type === 'CLOSING'))
                                    },
                                    {
                                        key: 'verification',
                                        label: 'Opening Count',
                                        children: renderCashCountTable(activeSession.cashCounts.filter(c => c.type === 'VERIFICATION'))
                                    }
                                ].filter(item => {
                                    const hasData = activeSession.cashCounts?.some(c => c.type === (item.key === 'closing' ? 'CLOSING' : 'VERIFICATION'));
                                    return hasData;
                                })}
                            />
                        </Card>
                    )
                    }

                    {/* Movements & Sales Detail */}
                    <Card style={{ marginTop: 24 }}>
                        <Tabs
                            defaultActiveKey="movements"
                            items={[
                                {
                                    key: 'movements',
                                    label: <Space><HistoryOutlined /> General Movements</Space>,
                                    children: (
                                        <Table
                                            dataSource={activeSession.movements}
                                            columns={movementsColumns}
                                            rowKey="id"
                                            pagination={false}
                                            scroll={{ y: 400 }}
                                        />
                                    )
                                },
                                {
                                    key: 'sales',
                                    label: <Space><ShopOutlined /> Sales Details</Space>,
                                    children: (
                                        <Table
                                            dataSource={activeSession.sales}
                                            columns={[
                                                {
                                                    title: 'Invoice',
                                                    dataIndex: 'invoiceNumber',
                                                    key: 'invoice',
                                                    render: (text: string) => <Text strong>{text}</Text>
                                                },
                                                {
                                                    title: 'Time',
                                                    dataIndex: 'date',
                                                    key: 'time',
                                                    render: (date: string) => dayjs(date).format('HH:mm')
                                                },
                                                {
                                                    title: 'Total Amount',
                                                    dataIndex: 'total',
                                                    key: 'total',
                                                    align: 'right',
                                                    render: (total: number) => formatVenezuelanPrice(Number(total))
                                                },
                                                {
                                                    title: 'Payment Methods',
                                                    dataIndex: 'paymentMethod',
                                                    key: 'methods',
                                                    render: (methods: string) => {
                                                        const parts = methods.split(', ');
                                                        return (
                                                            <Space wrap>
                                                                {parts.map((p, i) => {
                                                                    const [name, amount] = p.split(':');
                                                                    const label = i18nPaymentMethod(name.trim());
                                                                    return (
                                                                        <Tag key={i} color="blue">
                                                                            {label}: {amount ? formatVenezuelanPrice(parseFloat(amount)) : ''}
                                                                        </Tag>
                                                                    );
                                                                })}
                                                            </Space>
                                                        );
                                                    }
                                                }
                                            ]}
                                            rowKey="id"
                                            pagination={false}
                                            scroll={{ y: 400 }}
                                        />
                                    )
                                }
                            ]}
                        />
                    </Card>
                </>
            );
        }

        // Dashboard List (Always shown for Admin if no register is "selected" for detail)
        if (user?.role === 'ADMIN') {
            return (
                <Card
                    title={<Title level={4} style={{ margin: 0 }}>📊 Cash Registers Dashboard</Title>}
                    extra={<Button icon={<ReloadOutlined />} onClick={() => refetchRegisters()} />}
                >
                    <Table
                        dataSource={registers}
                        columns={registerColumns}
                        rowKey="id"
                        pagination={false}
                    />
                </Card>
            );
        }

        // For Cashiers or if no session
        return (
            <Card>
                <Empty
                    description="No active session"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                    <Button
                        type="primary"
                        size="large"
                        icon={<PlusOutlined />}
                        onClick={() => setIsOpenModalVisible(true)}
                    >
                        Open Cash
                    </Button>
                </Empty>
            </Card>
        );
    };

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2}>🏦 Cashier</Title>
                {activeSession && (
                    <Space>
                        {getStatusTag(activeSession.status)}
                        <Text type="secondary">
                            {activeSession.register.name} | Opened by: <strong>{activeSession.openedBy}</strong>
                        </Text>
                    </Space>
                )}
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: 'current',
                        label: 'Control Panel',
                        children: renderCurrentTab()
                    },
                    {
                        key: 'history',
                        label: (
                            <span>
                                <HistoryOutlined /> Global History
                            </span>
                        ),
                        children: (
                            <Card
                                extra={<Button icon={<ReloadOutlined />} onClick={() => refetchHistory()} />}
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
                                                <Title level={5}>Cash Session: {record.register.name}</Title>
                                                <Tabs
                                                    size="small"
                                                    items={[
                                                        {
                                                            key: 'movements',
                                                            label: 'General Movements',
                                                            children: (
                                                                <Table
                                                                    dataSource={record.movements}
                                                                    columns={movementsColumns}
                                                                    rowKey="id"
                                                                    pagination={false}
                                                                    size="small"
                                                                />
                                                            )
                                                        },
                                                        {
                                                            key: 'sales',
                                                            label: 'Sales Details',
                                                            children: (
                                                                <Table
                                                                    dataSource={record.sales}
                                                                    columns={[
                                                                        { title: 'Invoice', dataIndex: 'invoiceNumber', key: 'invoice' },
                                                                        { title: 'Total Amount', dataIndex: 'total', key: 'total', align: 'right', render: (total: number) => formatVenezuelanPrice(Number(total)) },
                                                                        { title: 'Payment Method', dataIndex: 'paymentMethod', key: 'methods', render: (m) => i18nPaymentMethod(m.split(':')[0]) }
                                                                    ]}
                                                                    rowKey="id"
                                                                    pagination={false}
                                                                    size="small"
                                                                />
                                                            )
                                                        }
                                                    ]}
                                                />

                                                {record.cashCounts && record.cashCounts.length > 0 && (
                                                    <div style={{ marginTop: 24 }}>
                                                        <Title level={5}>Reported Cash Count</Title>
                                                        {renderCashCountTable(record.cashCounts.filter(c => c.type === 'CLOSING'))}
                                                    </div>
                                                )}
                                            </div>
                                        ),
                                        expandIcon: ({ expanded, onExpand, record }) => (
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<EyeOutlined />}
                                                onClick={(e) => onExpand(record, e)}
                                            >
                                                {expanded ? 'Hide' : 'View details'}
                                            </Button>
                                        )
                                    }}
                                    pagination={{
                                        pageSize: 10,
                                        showTotal: (total) => `Total: ${total} sessions`
                                    }}
                                />
                            </Card>
                        )
                    },
                    user?.role === 'ADMIN' ? {
                        key: 'config',
                        label: (
                            <span>
                                <SettingOutlined /> Registers Management
                            </span>
                        ),
                        children: <RegistersManagement />
                    } : null
                ].filter(Boolean) as any}
            />

            {/* Modals */}
            <OpenSessionModal
                open={isOpenModalVisible}
                registerId={registerId}
                onCancel={() => {
                    setIsOpenModalVisible(false);
                    setRegisterId('');
                }}
                onSuccess={() => {
                    setIsOpenModalVisible(false);
                    refetch();
                    refetchRegisters();
                    queryClient.invalidateQueries({ queryKey: ['cashRegistersDashboard'] });
                }}
            />

            {activeSession && (
                <>
                    <CloseSessionModal
                        open={isCloseModalVisible}
                        session={activeSession}
                        onCancel={() => setIsCloseModalVisible(false)}
                        onSuccess={() => {
                            setIsCloseModalVisible(false);
                            refetch();
                            refetchHistory();
                            refetchRegisters();
                            queryClient.invalidateQueries({ queryKey: ['cashRegistersDashboard'] });
                        }}
                    />

                    <AddMovementModal
                        open={isAddMovementOpen}
                        sessionId={activeSession.id}
                        onCancel={() => setIsAddMovementOpen(false)}
                        onSuccess={() => {
                            setIsAddMovementOpen(false);
                            refetch();
                            refetchRegisters();
                            queryClient.invalidateQueries({ queryKey: ['cashRegistersDashboard'] });
                        }}
                    />

                    <TransferToTreasuryModal
                        open={isTransferToTreasuryOpen}
                        sessionId={activeSession.id}
                        onClose={() => {
                            setIsTransferToTreasuryOpen(false);
                            refetch();
                            refetchRegisters();
                            queryClient.invalidateQueries({ queryKey: ['cashRegistersDashboard'] });
                        }}
                    />
                </>
            )}

            {/* Verification Modal - Only for the assigned cashier */}
            <CashCountModal
                mode="OPENING"
                open={!!activeSession && activeSession.status === 'OPEN' && !activeSession.verifiedAt && activeSession.cashierId === user?.username}
                sessionId={activeSession?.id || ''}
                openingBalance={Number(activeSession?.openingBalance || 0)}
                onSuccess={() => {
                    refetch();
                    refetchRegisters();
                    queryClient.invalidateQueries({ queryKey: ['cashRegistersDashboard'] });
                }}
            />
        </div>
    );
};
