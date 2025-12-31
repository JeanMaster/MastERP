
import { useState } from 'react';
import { Card, Table, Button, Space, Input, message, Popconfirm, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, BankOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { banksApi } from '../../services/banksApi';
import type { BankAccount } from '../../services/banksApi';
import { BankFormModal } from './components/BankFormModal';
import { formatVenezuelanPrice } from '../../utils/formatters';

const { useBreakpoint } = Grid;

export const BanksPage = () => {
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [isModalOpen, setIsModalOpen] = useState(false);
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
            render: (text: string, record: BankAccount) => (
                <Space>
                    <BankOutlined />
                    <Space direction="vertical" size={0}>
                        <span style={{ fontWeight: 600 }}>{text}</span>
                        <span style={{ fontSize: '12px', color: '#888' }}>{record.accountType === 'CHECKING' ? 'Corriente' : 'Ahorro'}</span>
                    </Space>
                </Space>
            )
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
                <h1 style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '2rem' }}>Cuentas Bancarias</h1>
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
                            {isMobile ? 'Nueva' : 'Nueva Cuenta'}
                        </Button>
                    </Space>
                </Space>
            </div>

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
        </div>
    );
};
