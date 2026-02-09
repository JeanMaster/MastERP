
import { useState } from 'react';
import { Card, Table, Button, Space, Input, message, Popconfirm, Grid, Row, Col, Statistic } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, BankOutlined, HistoryOutlined, SwapOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { banksApi } from '../../services/banksApi';
import type { BankAccount } from '../../services/banksApi';
import { BankFormModal } from './components/BankFormModal';
import { BankHistoryModal } from './components/BankHistoryModal';
import { BankMovementModal } from './components/BankMovementModal';
import { formatVenezuelanPrice } from '../../utils/formatters';

const { useBreakpoint } = Grid;

export const BanksPage = () => {
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isMovementOpen, setIsMovementOpen] = useState(false);
    const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
    const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    const { data: banks = [], isLoading } = useQuery({
        queryKey: ['banks', searchTerm],
        queryFn: () => banksApi.getAll(searchTerm),
    });

    const deleteMutation = useMutation({
        mutationFn: banksApi.delete,
        onSuccess: () => {
            message.success('Cuenta eliminada');
            queryClient.invalidateQueries({ queryKey: ['banks'] });
        },
        onError: () => {
            message.error('Error al eliminar cuenta');
        },
    });

    const columns = [
        {
            title: 'Banco',
            dataIndex: 'bankName',
            key: 'bankName',
            render: (text: string, record: BankAccount) => {
                const types: Record<string, string> = {
                    'CHECKING': 'Cuenta Corriente',
                    'SAVINGS': 'Cuenta de Ahorro',
                    'CASH_VAULT': 'Bóveda / Efectivo',
                    'MOBILE_PAYMENT': 'Pago Móvil / Wallet'
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
            title: 'Número de Cuenta',
            dataIndex: 'accountNumber',
            key: 'accountNumber',
        },
        {
            title: 'Titular',
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
            title: 'Saldo',
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
            title: 'Acciones',
            key: 'actions',
            align: 'center' as const,
            render: (_: any, record: BankAccount) => (
                <Space>
                    <Button
                        type="text"
                        icon={<HistoryOutlined />}
                        title="Ver Historial"
                        onClick={() => {
                            setSelectedBank(record);
                            setIsHistoryOpen(true);
                        }}
                    />
                    <Button
                        type="text"
                        icon={<SwapOutlined />}
                        title="Registrar Movimiento"
                        onClick={() => {
                            setSelectedBank(record);
                            setIsMovementOpen(true);
                        }}
                    />
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => {
                            setEditingBank(record);
                            setIsModalOpen(true);
                        }}
                    />
                    <Popconfirm
                        title="¿Eliminar cuenta?"
                        description="Esta acción no se puede deshacer."
                        onConfirm={() => deleteMutation.mutate(record.id)}
                        okText="Sí"
                        cancelText="No"
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
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
                <h1 style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '2rem' }}>Tesorería y Liquidez</h1>
                <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }} align={isMobile ? 'end' : 'center'}>
                    <Input
                        placeholder="Buscar banco, titular..."
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
                            {isMobile ? 'Nuevo Recurso' : 'Nuevo Recurso / Caja'}
                        </Button>
                    </Space>
                </Space>
            </div>

            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card style={{ backgroundColor: '#f0f5ff' }}>
                        <Statistic
                            title="Total en Bancos"
                            value={banks.filter(b => ['CHECKING', 'SAVINGS'].includes(b.accountType)).reduce((acc, b) => acc + Number(b.balance), 0)}
                            precision={2}
                            prefix="Bs."
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card style={{ backgroundColor: '#f6ffed' }}>
                        <Statistic
                            title="Total en Bóveda / Efectivo"
                            value={banks.filter(b => b.accountType === 'CASH_VAULT').reduce((acc, b) => acc + Number(b.balance), 0)}
                            precision={2}
                            prefix="Bs."
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card style={{ backgroundColor: '#fff7e6', borderColor: '#ffa940', borderWidth: 2 }}>
                        <Statistic
                            title="Liquidez Total (Consolidada)"
                            value={banks.reduce((acc, b) => acc + Number(b.balance), 0)}
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
        </div >
    );
};
