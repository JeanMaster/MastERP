import { useState } from 'react';
import { Card, Table, Button, Input, Tag, Typography, Statistic, Row, Col, Space, Grid, Tooltip } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined, DollarOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { expensesApi, type Expense } from '../../services/expensesApi';
import { CreateExpenseModal } from './components/CreateExpenseModal';
import { formatVenezuelanPrice } from '../../utils/formatters';

const { Title } = Typography;

export const ExpensesPage = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [searchText, setSearchText] = useState('');

    const { data: expenses = [], isLoading, refetch } = useQuery({
        queryKey: ['expenses'],
        queryFn: expensesApi.getAll
    });

    const handleCreate = () => {
        setEditingExpense(null);
        setIsCreateModalOpen(true);
    };

    const handleEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setIsCreateModalOpen(true);
    };

    // Defensive check to ensure expenses is an array
    const safeExpenses = Array.isArray(expenses) ? expenses : [];

    const filteredExpenses = safeExpenses.filter(expense =>
        expense.description.toLowerCase().includes(searchText.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchText.toLowerCase())
    );

    // Calculate totals - This logic needs to be smarter about currencies
    // Ideally user wants to see total in USD (or base currency)
    // We can assume if currencyCode is not VES, we use amount directly (assuming USD)
    // If it is VES, we divide by exchangeRate.
    // Or we simply sum by currency for now.

    // Calculate totals
    const calculateTotalInUSD = (list: Expense[]) => {
        return list.reduce((sum, e) => {
            // If currency is USD, take amount directly
            if (e.currencyCode === 'USD') {
                return sum + Number(e.amount);
            }
            // If currency is NOT USD (e.g. VES), divide by rate
            // Assuming rate is always stored as VES/USD (e.g. 50)
            const rate = Number(e.exchangeRate) || 1;
            // If the rate is 1, it means we probably don't have a conversion, so we might as well return amount 
            // BUT if it's VES and rate is 1, then $1000 VES = $1000 USD is WRONG.
            // If rate is 1, it's virtually 0 dollars in hyperinflation, or data error.
            // However, to avoid NaN, we divide by rate.
            return sum + (Number(e.amount) / rate);
        }, 0);
    };

    const totalTodayUSD = calculateTotalInUSD(
        filteredExpenses.filter(e => dayjs(e.date).isSame(dayjs(), 'day'))
    );

    const totalMonthUSD = calculateTotalInUSD(
        filteredExpenses.filter(e => dayjs(e.date).isSame(dayjs(), 'month'))
    );

    const columns = [
        {
            title: 'Fecha',
            dataIndex: 'date',
            key: 'date',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
            sorter: (a: Expense, b: Expense) => dayjs(a.date).unix() - dayjs(b.date).unix(),
            width: 100,
        },
        {
            title: 'Descripción',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Categoría',
            dataIndex: 'category',
            key: 'category',
            render: (category: string) => <Tag color="blue">{category}</Tag>,
            filters: Array.from(new Set(safeExpenses.map(e => e.category))).map(c => ({ text: c, value: c })),
            onFilter: (value: any, record: Expense) => record.category === value,
        },
        {
            title: 'Monto Original',
            key: 'originalAmount',
            align: 'right' as const,
            render: (_: any, record: Expense) => (
                <Space direction="vertical" size={0} style={{ textAlign: 'right' }}>
                    <Typography.Text strong>
                        {formatVenezuelanPrice(record.amount, record.currencyCode === 'VES' ? 'Bs' : '$')}
                    </Typography.Text>
                    {record.exchangeRate && Number(record.exchangeRate) !== 1 && (
                        <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                            Tasa: {record.exchangeRate}
                        </Typography.Text>
                    )}
                </Space>
            ),
        },
        {
            title: 'Relativo ($)',
            key: 'usdAmount',
            align: 'right' as const,
            render: (_: any, record: Expense) => {
                let usdAmount = 0;
                const rate = Number(record.exchangeRate) || 1;

                if (record.currencyCode === 'USD') {
                    usdAmount = Number(record.amount);
                } else {
                    // Assume VES or other weak currency divided by rate
                    usdAmount = Number(record.amount) / rate;
                }

                return (
                    <Typography.Text type="secondary">
                        {formatVenezuelanPrice(usdAmount, '$')}
                    </Typography.Text>
                );
            }
        },
        {
            title: 'Método',
            dataIndex: 'paymentMethod',
            key: 'paymentMethod',
            render: (method: string) => {
                const methodMap: Record<string, string> = {
                    'CASH': 'Efectivo',
                    'TRANSFER': 'Transferencia',
                    'PAGO_MOVIL': 'Pago Móvil',
                    'DEBIT': 'Débito',
                    'CREDIT': 'Crédito',
                    'ZELLE': 'Zelle',
                    'USDT': 'USDT'
                };
                return methodMap[method] || method;
            }
        },
        {
            title: 'Ref.',
            dataIndex: 'reference',
            key: 'reference',
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: 80,
            render: (_: any, record: Expense) => (
                <Tooltip title="Editar Gasto">
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        size="small"
                        type="text"
                    />
                </Tooltip>
            )
        }
    ];

    return (
        <div style={{ padding: isMobile ? '8px' : '24px' }}>
            <div style={{ marginBottom: 24 }}>
                <Title level={isMobile ? 3 : 2}>Gastos Operativos</Title>
                <Row gutter={[16, 16]}>
                    <Col xs={12} sm={12} md={6}>
                        <Card size={isMobile ? 'small' : 'default'}>
                            <Statistic
                                title="De Hoy (Ref $)"
                                value={totalTodayUSD}
                                precision={2}
                                valueStyle={{ color: '#cf1322', fontSize: isMobile ? '16px' : '24px' }}
                                styles={{ content: { color: '#cf1322' } }}
                                prefix={<DollarOutlined />}
                                suffix="$"
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={12} md={6}>
                        <Card size={isMobile ? 'small' : 'default'}>
                            <Statistic
                                title="Del Mes (Ref $)"
                                value={totalMonthUSD}
                                precision={2}
                                valueStyle={{ color: '#cf1322', fontSize: isMobile ? '16px' : '24px' }}
                                styles={{ content: { color: '#cf1322' } }}
                                prefix={<DollarOutlined />}
                                suffix="$"
                            />
                        </Card>
                    </Col>
                </Row>
            </div>

            <Card
                extra={
                    <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }} align={isMobile ? 'end' : 'center'}>
                        <Input
                            placeholder="Buscar gastos..."
                            prefix={<SearchOutlined />}
                            onChange={e => setSearchText(e.target.value)}
                            style={{ width: isMobile ? '100%' : 200 }}
                        />
                        <Space>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => refetch()}
                            />
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleCreate}
                                danger
                                block={isMobile}
                            >
                                {isMobile ? 'Registrar' : 'Registrar Gasto'}
                            </Button>
                        </Space>
                    </Space>
                }
            >
                <Table
                    columns={columns}
                    dataSource={filteredExpenses}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 'max-content' }}
                />
            </Card>

            <CreateExpenseModal
                open={isCreateModalOpen}
                onCancel={() => setIsCreateModalOpen(false)}
                expense={editingExpense}
            />
        </div>
    );
};
