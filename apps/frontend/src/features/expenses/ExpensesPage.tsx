import { useState } from 'react';
import { Card, Table, Button, Input, Tag, Typography, Statistic, Row, Col, Space, Grid, Tooltip } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined, DollarOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { expensesApi, type Expense } from '../../services/expensesApi';
import { CreateExpenseModal } from './components/CreateExpenseModal';
import { formatVenezuelanPrice } from '../../utils/formatters';

const { Title } = Typography;

/**
 * ExpensesPage Component
 * Displays a list of operative expenses with totals and filtering capabilities.
 */
export const ExpensesPage = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const { t } = useTranslation();
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

    /**
     * Calculates totals in USD based on exchange rate at the time of expense.
     */
    const calculateTotalInUSD = (list: Expense[]) => {
        return list.reduce((sum, e) => {
            if (e.currencyCode === 'USD') {
                return sum + Number(e.amount);
            }
            const rate = Number(e.exchangeRate) || 1;
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
            title: t('common.date'),
            dataIndex: 'date',
            key: 'date',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
            sorter: (a: Expense, b: Expense) => dayjs(a.date).unix() - dayjs(b.date).unix(),
            width: 100,
        },
        {
            title: t('expenses.description'),
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: t('expenses.category'),
            dataIndex: 'category',
            key: 'category',
            render: (category: string) => (
                <Tag color="blue">{t(`expenses.categories.${category}`, { defaultValue: category })}</Tag>
            ),
            filters: Array.from(new Set(safeExpenses.map(e => e.category))).map(c => ({
                text: t(`expenses.categories.${c}`, { defaultValue: c }),
                value: c,
            })),
            onFilter: (value: any, record: Expense) => record.category === value,
        },
        {
            title: t('expenses_page.original_amount'),
            key: 'originalAmount',
            align: 'right' as const,
            render: (_: any, record: Expense) => (
                <Space direction="vertical" size={0} style={{ textAlign: 'right' }}>
                    <Typography.Text strong>
                        {formatVenezuelanPrice(record.amount, record.currencyCode === 'VES' ? 'Bs' : '$')}
                    </Typography.Text>
                    {record.exchangeRate && Number(record.exchangeRate) !== 1 && (
                        <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                            {t('expenses_page.rate')}: {record.exchangeRate}
                        </Typography.Text>
                    )}
                </Space>
            ),
        },
        {
            title: t('expenses_page.relative_usd'),
            key: 'usdAmount',
            align: 'right' as const,
            render: (_: any, record: Expense) => {
                let usdAmount = 0;
                const rate = Number(record.exchangeRate) || 1;

                if (record.currencyCode === 'USD') {
                    usdAmount = Number(record.amount);
                } else {
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
            title: t('expenses_page.method_account'),
            key: 'paymentMethod',
            render: (_: any, record: Expense) => {
                const methodName = t(`expenses.payment_methods.${record.paymentMethod}`, { defaultValue: record.paymentMethod });

                return (
                    <Space direction="vertical" size={0}>
                        <Typography.Text>{methodName}</Typography.Text>
                        {record.bankAccount && (
                            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                {record.bankAccount.bankName}
                            </Typography.Text>
                        )}
                    </Space>
                );
            }
        },
        {
            title: t('common.reference'),
            dataIndex: 'reference',
            key: 'reference',
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 80,
            render: (_: any, record: Expense) => (
                <Tooltip title={t('expenses_page.edit_expense')}>
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
                <Title level={isMobile ? 3 : 2}>{t('expenses.title')}</Title>
                <Row gutter={[16, 16]}>
                    <Col xs={12} sm={12} md={6}>
                        <Card size={isMobile ? 'small' : 'default'}>
                            <Statistic
                                title={t('expenses_page.today_ref')}
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
                                title={t('expenses_page.month_ref')}
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
                            placeholder={t('expenses_page.search_placeholder')}
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
                                {isMobile ? t('expenses_page.register_short') : t('expenses.register_new')}
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
