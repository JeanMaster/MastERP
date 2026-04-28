import { useState } from 'react';
import { Card, Table, Button, Space, Input, App, Popconfirm, Grid, Row, Col, Statistic } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, BankOutlined, HistoryOutlined, SwapOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { banksApi } from '../../services/banksApi';
import type { BankAccount } from '../../services/banksApi';
import { BankFormModal } from './components/BankFormModal';
import { BankHistoryModal } from './components/BankHistoryModal';
import { BankMovementModal } from './components/BankMovementModal';
import { formatVenezuelanPrice } from '../../utils/formatters';
import { LiquidateBatchModal } from './components/LiquidateBatchModal';

const { useBreakpoint } = Grid;

/**
 * BanksPage Component
 * Manages bank accounts, vault, and liquidity.
 */
export const BanksPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isMovementOpen, setIsMovementOpen] = useState(false);
    const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
    const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
    const [isLiquidateOpen, setIsLiquidateOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    const { data: banks = [], isLoading } = useQuery({
        queryKey: ['banks', searchTerm],
        queryFn: () => banksApi.getAll(searchTerm),
    });

    const deleteMutation = useMutation({
        mutationFn: banksApi.delete,
        onSuccess: () => {
            message.success(t('banks.messages.success_delete'));
            queryClient.invalidateQueries({ queryKey: ['banks'] });
        },
        onError: () => {
            message.error(t('banks.messages.error_delete'));
        },
    });

    const columns = [
        {
            title: t('banks.table.bank_resource'),
            dataIndex: 'bankName',
            key: 'bankName',
            render: (text: string, record: BankAccount) => {
                const types: Record<string, string> = {
                    'CHECKING': t('banks.table.checking'),
                    'SAVINGS': t('banks.table.savings'),
                    'CASH_VAULT': t('banks.table.cash_vault'),
                    'MOBILE_PAYMENT': t('banks.table.mobile_payment')
                };
                return (
                    <Space>
                        <BankOutlined />
                        <Space direction="vertical" size={0}>
                            <span style={{ fontWeight: 600 }}>{text}</span>
                            <span style={{ fontSize: '12px', color: '#888' }}>{types[record.accountType] || record.accountType}</span>
                        </Space>
                    </Space>
                );
            }
        },
        {
            title: t('banks.table.account_number'),
            dataIndex: 'accountNumber',
            key: 'accountNumber',
        },
        {
            title: t('banks.table.holder'),
            dataIndex: 'holderName',
            key: 'holderName',
            render: (text: string, record: BankAccount) => (
                <Space direction="vertical" size={0}>
                    <span>{text}</span>
                    <span style={{ fontSize: '11px', color: '#888' }}>{record.holderId}</span>
                </Space>
            )
        },
        {
            title: t('banks.table.real_balance'),
            dataIndex: 'balance',
            key: 'balance',
            align: 'right' as const,
            render: (balance: number, record: BankAccount) => (
                <span style={{ fontWeight: 600, color: balance >= 0 ? 'green' : 'red' }}>
                    {record.currency.symbol} {formatVenezuelanPrice(balance)}
                </span>
            )
        },
        {
            title: t('banks.table.in_transit'),
            dataIndex: 'pendingLiquidation',
            key: 'pendingLiquidation',
            align: 'right' as const,
            render: (pending: number, record: BankAccount) => (
                pending > 0 ? (
                    <Space direction="vertical" size={0} align="end">
                        <span style={{ fontWeight: 600, color: '#1890ff' }}>
                            {record.currency.symbol} {formatVenezuelanPrice(pending)}
                        </span>
                        <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, fontSize: '11px' }}
                            onClick={() => {
                                setSelectedBank(record);
                                setIsLiquidateOpen(true);
                            }}
                        >
                            {t('banks.actions.liquidate_batch')}
                        </Button>
                    </Space>
                ) : <span style={{ color: '#ccc' }}>-</span>
            )
        },
        {
            title: t('banks.table.actions'),
            key: 'actions',
            align: 'center' as const,
            render: (_: any, record: BankAccount) => (
                <Space>
                    <Button
                        type="text"
                        icon={<HistoryOutlined />}
                        title={t('banks.actions.view_history')}
                        onClick={() => {
                            setSelectedBank(record);
                            setIsHistoryOpen(true);
                        }}
                    />
                    <Button
                        type="text"
                        icon={<SwapOutlined />}
                        title={t('banks.actions.register_movement')}
                        onClick={() => {
                            setSelectedBank(record);
                            setIsMovementOpen(true);
                        }}
                    />
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        title={t('banks.actions.edit_account')}
                        onClick={() => {
                            setEditingBank(record);
                            setIsModalOpen(true);
                        }}
                    />
                    <Popconfirm
                        title={t('banks.messages.delete_confirm_title')}
                        description={t('banks.messages.delete_confirm_desc')}
                        onConfirm={() => deleteMutation.mutate(record.id)}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} title={t('banks.actions.delete_account')} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBank(null);
    };

    return (
        <div className="fade-in">
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: 16,
                gap: isMobile ? 12 : 0
            }}>
                <h1 style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '2rem' }}>{t('banks.title')}</h1>
                <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }} align={isMobile ? 'end' : 'center'}>
                    <Input
                        placeholder={t('banks.search_placeholder')}
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: isMobile ? '100%' : 250 }}
                    />
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['banks'] })}
                        />
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                            {isMobile ? t('banks.new_resource_mobile') : t('banks.new_resource')}
                        </Button>
                    </Space>
                </Space>
            </div>

            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={6}>
                    <Card style={{ backgroundColor: '#f0f5ff' }}>
                        <Statistic
                            title={t('banks.total_banks')}
                            value={banks.filter(b => ['CHECKING', 'SAVINGS'].includes(b.accountType)).reduce((acc, b) => acc + Number(b.balance), 0)}
                            precision={2}
                            prefix="Bs."
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={6}>
                    <Card style={{ backgroundColor: '#fffbe6' }}>
                        <Statistic
                            title={t('banks.total_transit')}
                            value={banks.reduce((acc, b) => acc + Number(b.pendingLiquidation || 0), 0)}
                            precision={2}
                            prefix="Bs."
                            valueStyle={{ color: '#d4b106' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={6}>
                    <Card style={{ backgroundColor: '#f6ffed' }}>
                        <Statistic
                            title={t('banks.total_vault')}
                            value={banks.filter(b => b.accountType === 'CASH_VAULT').reduce((acc, b) => acc + Number(b.balance), 0)}
                            precision={2}
                            prefix="Bs."
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={6}>
                    <Card style={{ backgroundColor: '#fff7e6', borderColor: '#ffa940', borderWidth: 2 }}>
                        <Statistic
                            title={t('banks.liquidity_consolidated')}
                            value={banks.reduce((acc, b) => acc + Number(b.balance) + Number(b.pendingLiquidation || 0), 0)}
                            precision={2}
                            prefix="Bs."
                            valueStyle={{ color: '#fa8c16', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Card styles={{ body: { padding: 0 } }}>
                <Table
                    columns={columns}
                    dataSource={banks}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 'max-content' }}
                />
            </Card>

            <BankFormModal
                open={isModalOpen}
                bankAccount={editingBank}
                onClose={handleCloseModal}
            />

            <BankHistoryModal
                open={isHistoryOpen}
                bankAccount={selectedBank}
                onClose={() => {
                    setIsHistoryOpen(false);
                    setSelectedBank(null);
                }}
            />

            <BankMovementModal
                open={isMovementOpen}
                bankAccount={selectedBank}
                onClose={() => {
                    setIsMovementOpen(false);
                    setSelectedBank(null);
                }}
            />

            {selectedBank && (
                <LiquidateBatchModal
                    open={isLiquidateOpen}
                    bankAccount={selectedBank}
                    onClose={() => {
                        setIsLiquidateOpen(false);
                        setSelectedBank(null);
                    }}
                />
            )}
        </div >
    );
};
