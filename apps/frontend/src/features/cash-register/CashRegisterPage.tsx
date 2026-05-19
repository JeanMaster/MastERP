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
    App,
    Grid,
    List
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
    UndoOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const { message } = App.useApp();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [registerId, setRegisterId] = useState<string>('');
    const [isOpenModalVisible, setIsOpenModalVisible] = useState(false);
    const [isCloseModalVisible, setIsCloseModalVisible] = useState(false);
    const [isAddMovementOpen, setIsAddMovementOpen] = useState(false);
    const [isTransferToTreasuryOpen, setIsTransferToTreasuryOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('current');

    const { data: registers = [], isLoading: isLoadingRegisters, refetch: refetchRegisters } = useQuery({
        queryKey: ['cashRegistersDashboard'],
        queryFn: () => cashRegisterApi.listRegisters()
    });

    const { data: mainRegister } = useQuery({
        queryKey: ['cashRegisterMain'],
        queryFn: () => cashRegisterApi.getMainRegister()
    });

    useEffect(() => {
        if (user?.role === 'CASHIER' && mainRegister && !registerId) {
            setRegisterId(mainRegister.id);
        }
    }, [mainRegister, user]);

    const { data: activeSession, isLoading, refetch } = useQuery({
        queryKey: ['activeSession', registerId],
        queryFn: () => cashRegisterApi.getActiveSession(registerId),
        enabled: !!registerId,
        refetchInterval: 10000
    });

    const { data: closedSessions = [], refetch: refetchHistory } = useQuery({
        queryKey: ['closedSessions', registerId],
        queryFn: () => cashRegisterApi.listSessions({ status: 'CLOSED', registerId }),
        enabled: !!registerId
    });

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
        const methodsBreakdown: Record<string, number> = { CASH: 0, CURRENCY_USD: 0, DEBIT: 0, MOBILE: 0, TRANSFER: 0, CREDIT: 0 };

        session.movements.forEach(movement => {
            const amountInBs = Number(movement.amount) * Number(movement.exchangeRate || 1);
            switch (movement.type) {
                case 'SALE': sales += amountInBs; break;
                case 'EXPENSE': expenses += amountInBs; break;
                case 'DEPOSIT': deposits += amountInBs; break;
                case 'WITHDRAWAL': withdrawals += amountInBs; break;
                case 'CHANGE': sales -= amountInBs; break;
                case 'ADJUSTMENT':
                    if (amountInBs > 0) withdrawals += amountInBs;
                    else deposits += Math.abs(amountInBs);
                    break;
            }
        });

        session.sales?.forEach(sale => {
            const saleMethods = parsePaymentMethods(sale.paymentMethod, Number(sale.total));
            Object.entries(saleMethods).forEach(([method, amount]) => {
                methodsBreakdown[method] = (methodsBreakdown[method] || 0) + amount;
            });
        });

        const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
        const expected = round(Number(session.openingBalance) + sales + withdrawals - expenses - deposits);
        return { sales: round(sales), expenses: round(expenses), deposits: round(deposits), withdrawals: round(withdrawals), expected };
    };

    const getMovementIcon = (type: string) => {
        switch (type) {
            case 'SALE': return <ShopOutlined style={{ color: '#52c41a' }} />;
            case 'EXPENSE': return <DollarOutlined style={{ color: '#ff4d4f' }} />;
            case 'DEPOSIT': return <BankOutlined style={{ color: '#1890ff' }} />;
            case 'WITHDRAWAL': return <LogoutOutlined style={{ color: '#faad14' }} />;
            default: return null;
        }
    };

    const getMovementTypeLabel = (type: string) => t(`cash_register.types.${type}`, { defaultValue: type });

    const movementsColumns = [
        { title: t('cash_register.time'), dataIndex: 'createdAt', key: 'time', width: 80, render: (date: string) => dayjs(date).format('HH:mm') },
        { title: t('cash_register.type'), dataIndex: 'type', key: 'type', render: (type: string) => <Space>{getMovementIcon(type)} <Text>{getMovementTypeLabel(type)}</Text></Space> },
        { title: t('cash_register.description'), dataIndex: 'description', key: 'description' },
        { title: t('cash_register.amount'), dataIndex: 'amount', key: 'amount', align: 'right' as const, render: (amount: number, _record: CashMovement) => <Text strong>{formatVenezuelanPrice(amount)}</Text> }
    ];

    const historyColumns = [
        { title: t('cash_register.date'), key: 'date', render: (_: any, record: CashSession) => <strong>{dayjs(record.openedAt).format('MM/DD/YYYY')}</strong> },
        { title: t('cash_register.responsible'), key: 'user', render: (_: any, record: CashSession) => record.openedBy },
        { title: t('cash_register.opening'), dataIndex: 'openingBalance', key: 'opening', align: 'right' as const, render: (val: any) => formatVenezuelanPrice(Number(val)) },
        { title: t('cash_register.actual'), dataIndex: 'actualBalance', key: 'actual', align: 'right' as const, render: (val: any) => formatVenezuelanPrice(Number(val || 0)) },
        { title: t('cash_register.status'), dataIndex: 'status', key: 'status', render: (status: string) => getStatusTag(status) }
    ];

    const getStatusTag = (status: string) => {
        switch (status) {
            case 'OPEN': return <Tag color="success">{t('cash_register.open')}</Tag>;
            case 'AWAITING_CLOSE': return <Tag color="warning">{t('cash_register.awaiting_close')}</Tag>;
            case 'CLOSED': return <Tag color="default">{t('cash_register.closed')}</Tag>;
            default: return <Tag>{status}</Tag>;
        }
    };

    const handleOpenRegister = (id: string) => { setRegisterId(id); setIsOpenModalVisible(true); };
    const handleSelectRegister = (id: string) => { setRegisterId(id); setActiveTab('current'); };
    const handleApproveClose = async (sessionId: string) => {
        try { 
            await cashRegisterApi.approveClose(sessionId, user?.username || 'Admin'); 
            message.success(t('cash_register.authorize_success')); 
            refetch(); 
            refetchHistory(); 
            refetchRegisters(); 
        } catch (error: any) { 
            message.error(error.message); 
        }
    };

    const registerColumns = [
        { title: t('cash_register.register_name'), dataIndex: 'name', key: 'name' },
        { title: t('cash_register.location', { defaultValue: 'Location' }), dataIndex: 'location', key: 'location' },
        { title: t('cash_register.status'), key: 'status', render: (_: any, record: CashRegister) => record.activeSession ? getStatusTag(record.activeSession.status) : '-' },
        { 
            title: t('cash_register.actions'), 
            key: 'actions', 
            align: 'right' as const,
            render: (_: any, record: CashRegister) => (
                <Space>
                    {!record.activeSession ? (
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => handleOpenRegister(record.id)}>
                            {t('cash_register.open')}
                        </Button>
                    ) : (
                        <Button size="small" icon={<EyeOutlined />} onClick={() => handleSelectRegister(record.id)}>
                            {t('cash_register.view_details')}
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    const renderCurrentTab = () => {
        if (isLoadingRegisters || (registerId && isLoading)) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
        
        if (registerId && activeSession) {
            const summary = calculateSummary(activeSession);
            return (
                <div style={{ animation: 'fadeIn 0.5s ease' }}>
                    <div style={{ marginBottom: 16 }}>
                        <Button icon={<UndoOutlined />} onClick={() => setRegisterId('')}>
                            {t('common.back')}
                        </Button>
                    </div>

                    {activeSession.status === 'AWAITING_CLOSE' && user?.role === 'ADMIN' && (
                        <Alert
                            message={t('cash_register.requests_close')}
                            description={
                                <Space direction="vertical">
                                    <Text>{t('cash_register.close_request_desc')}</Text>
                                    <Button type="primary" ghost icon={<CheckCircleOutlined />} onClick={() => handleApproveClose(activeSession.id)}>
                                        {t('cash_register.authorize_button')}
                                    </Button>
                                </Space>
                            }
                            type="warning"
                            showIcon
                            style={{ marginBottom: 24 }}
                        />
                    )}

                    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col xs={24} sm={12} lg={6}>
                            <Card style={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                <Statistic title={t('cash_register.opening_balance')} value={activeSession.openingBalance} prefix="Bs." precision={2} />
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} lg={6}>
                            <Card style={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                <Statistic title={t('cash_register.total_sales')} value={summary.sales} prefix="Bs." precision={2} styles={{ content: { color: '#3f8600' } }} />
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} lg={6}>
                            <Card style={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                <Statistic title={t('cash_register.expenses_withdrawals')} value={summary.expenses + summary.deposits} prefix="Bs." precision={2} styles={{ content: { color: '#cf1322' } }} />
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} lg={6}>
                            <Card style={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#f0f5ff' }}>
                                <Statistic title={t('cash_register.expected_cash')} value={summary.expected} prefix="Bs." precision={2} styles={{ content: { color: '#1890ff', fontWeight: 'bold' } }} />
                            </Card>
                        </Col>
                    </Row>

                    <Card 
                        title={<Space><HistoryOutlined /> {t('cash_register.movements_tab')}</Space>}
                        extra={
                            <Button 
                                type="primary" 
                                size="small" 
                                icon={<PlusOutlined />} 
                                onClick={() => setIsAddMovementOpen(true)}
                            >
                                {isMobile ? '' : t('cash_register.add_movement')}
                            </Button>
                        }
                        style={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
                    >
                        {!isMobile ? (
                            <Table dataSource={activeSession.movements} columns={movementsColumns} rowKey="id" pagination={{ pageSize: 10 }} />
                        ) : (
                            <List
                                dataSource={activeSession.movements}
                                pagination={{ pageSize: 5, size: 'small', simple: true }}
                                renderItem={(item: CashMovement) => (
                                    <List.Item style={{ padding: '12px 0' }}>
                                        <div style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <Space>
                                                    {getMovementIcon(item.type)}
                                                    <Text strong>{item.description}</Text>
                                                </Space>
                                                <Tag color={item.type === 'SALE' || item.type === 'DEPOSIT' ? 'green' : 'red'}>
                                                    {getMovementTypeLabel(item.type)}
                                                </Tag>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text type="secondary" style={{ fontSize: '12px' }}>{dayjs(item.createdAt).format('HH:mm')}</Text>
                                                <Text strong>Bs. {formatVenezuelanPrice(item.amount)}</Text>
                                            </div>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        )}
                    </Card>
                </div>
            );
        }

        if (user?.role === 'ADMIN') {
            return (
                <Card 
                    title={t('cash_register.dashboard_title')}
                    style={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
                    styles={{ body: { padding: isMobile ? 12 : 24 } }}
                >
                    {!isMobile ? (
                        <Table dataSource={registers} columns={registerColumns} rowKey="id" pagination={false} />
                    ) : (
                        <List
                            dataSource={registers}
                            renderItem={(record: CashRegister) => (
                                <List.Item style={{
                                    padding: '16px',
                                    background: '#fff',
                                    marginBottom: 12,
                                    borderRadius: 16,
                                    border: '1px solid #f0f0f0',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                    display: 'block'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 16 }}>{record.name}</div>
                                            <Text type="secondary" style={{ fontSize: 12 }}>{record.location || '—'}</Text>
                                        </div>
                                        {record.activeSession ? getStatusTag(record.activeSession.status) : <Tag>{t('cash_register.closed')}</Tag>}
                                    </div>
                                    <div>
                                        {!record.activeSession ? (
                                            <Button type="primary" block icon={<PlusOutlined />} onClick={() => handleOpenRegister(record.id)}>
                                                {t('cash_register.open')}
                                            </Button>
                                        ) : (
                                            <Button block icon={<EyeOutlined />} onClick={() => handleSelectRegister(record.id)}>
                                                {t('cash_register.view_details')}
                                            </Button>
                                        )}
                                    </div>
                                </List.Item>
                            )}
                        />
                    )}
                </Card>
            );
        }

        return (
            <Empty description={t('cash_register.no_active_session')}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsOpenModalVisible(true)}>
                    {t('cash_register.open_register')}
                </Button>
            </Empty>
        );
    };

    return (
        <div style={{ padding: isMobile ? '12px' : '24px 32px', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>
                    <BankOutlined /> {t('menu.cash_register')}
                </Title>
                {activeSession && (
                    <Space>
                        <Button danger icon={<LogoutOutlined />} onClick={() => setIsCloseModalVisible(true)}>
                            {isMobile ? '' : t('cash_register.close_register')}
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
                    </Space>
                )}
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                size={isMobile ? 'middle' : 'large'}
                items={[
                    {
                        key: 'current',
                        label: <Space><ShopOutlined /> {isMobile ? t('cash_register.control_panel_short', { defaultValue: 'Panel' }) : t('cash_register.control_panel')}</Space>,
                        children: renderCurrentTab()
                    },
                    {
                        key: 'history',
                        label: <Space><HistoryOutlined /> {isMobile ? t('cash_register.history_short', { defaultValue: 'Historial' }) : t('cash_register.history_tab')}</Space>,
                        children: (
                            <Card style={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }} styles={{ body: { padding: isMobile ? 12 : 24 } }}>
                                {!isMobile ? (
                                    <Table 
                                        dataSource={closedSessions} 
                                        columns={historyColumns} 
                                        rowKey="id" 
                                        pagination={{ pageSize: 10 }}
                                    />
                                ) : (
                                    <List
                                        dataSource={closedSessions}
                                        pagination={{ pageSize: 8, size: 'small', simple: true }}
                                        renderItem={(record: CashSession) => (
                                            <List.Item style={{
                                                padding: '16px',
                                                background: '#fff',
                                                marginBottom: 12,
                                                borderRadius: 16,
                                                border: '1px solid #f0f0f0',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                                display: 'block'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                    <Text strong style={{ fontSize: 15 }}>{dayjs(record.openedAt).format('DD/MM/YYYY')}</Text>
                                                    {getStatusTag(record.status)}
                                                </div>
                                                <div style={{ background: '#f9fafb', borderRadius: 12, padding: 12 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Text type="secondary" style={{ fontSize: 13 }}>{t('cash_register.responsible')}</Text>
                                                        <Text style={{ fontSize: 13 }}>{record.openedBy}</Text>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Text type="secondary" style={{ fontSize: 13 }}>{t('cash_register.opening')}</Text>
                                                        <Text style={{ fontSize: 13 }}>{formatVenezuelanPrice(Number(record.openingBalance))}</Text>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Text type="secondary" style={{ fontSize: 13 }}>{t('cash_register.actual')}</Text>
                                                        <Text strong style={{ fontSize: 13 }}>{formatVenezuelanPrice(Number(record.actualBalance || 0))}</Text>
                                                    </div>
                                                </div>
                                            </List.Item>
                                        )}
                                    />
                                )}
                            </Card>
                        )
                    },
                    user?.role === 'ADMIN' ? {
                        key: 'config',
                        label: <Space><SettingOutlined /> {isMobile ? '⚙️' : t('common.configuration')}</Space>,
                        children: <RegistersManagement />
                    } : null
                ].filter(Boolean) as any}
            />

            <OpenSessionModal
                open={isOpenModalVisible}
                registerId={registerId}
                onCancel={() => { setIsOpenModalVisible(false); setRegisterId(''); }}
                onSuccess={() => { setIsOpenModalVisible(false); refetch(); refetchRegisters(); queryClient.invalidateQueries({ queryKey: ['cashRegistersDashboard'] }); }}
            />

            {activeSession && (
                <>
                    <CloseSessionModal
                        open={isCloseModalVisible}
                        session={activeSession}
                        onCancel={() => setIsCloseModalVisible(false)}
                        onSuccess={() => { setIsCloseModalVisible(false); refetch(); refetchHistory(); refetchRegisters(); queryClient.invalidateQueries({ queryKey: ['cashRegistersDashboard'] }); }}
                    />
                    <AddMovementModal
                        open={isAddMovementOpen}
                        sessionId={activeSession.id}
                        onCancel={() => setIsAddMovementOpen(false)}
                        onSuccess={() => { setIsAddMovementOpen(false); refetch(); refetchRegisters(); queryClient.invalidateQueries({ queryKey: ['cashRegistersDashboard'] }); }}
                    />
                    <TransferToTreasuryModal
                        open={isTransferToTreasuryOpen}
                        sessionId={activeSession.id}
                        onClose={() => { setIsTransferToTreasuryOpen(false); refetch(); refetchRegisters(); queryClient.invalidateQueries({ queryKey: ['cashRegistersDashboard'] }); }}
                    />
                </>
            )}

            <CashCountModal
                mode="OPENING"
                open={!!activeSession && activeSession.status === 'OPEN' && !activeSession.verifiedAt && activeSession.cashierId === user?.username}
                sessionId={activeSession?.id || ''}
                openingBalance={Number(activeSession?.openingBalance || 0)}
                onSuccess={() => { refetch(); refetchRegisters(); queryClient.invalidateQueries({ queryKey: ['cashRegistersDashboard'] }); }}
            />
        </div>
    );
};
