import { useState } from 'react';
import { Card, Table, Button, Input, Tag, Typography, Statistic, Row, Col, Space, Grid, Tooltip, Pagination } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined, DollarOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { expensesApi, type Expense } from '../../services/expensesApi';
import { currenciesApi } from '../../services/currenciesApi';
import { companySettingsApi } from '../../services/companySettingsApi';
import { CreateExpenseModal } from './components/CreateExpenseModal';
import { formatVenezuelanPrice } from '../../utils/formatters';

const { Title, Text } = Typography;

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
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const { data: expenses = [], isLoading, refetch } = useQuery({
        queryKey: ['expenses'],
        queryFn: expensesApi.getAll
    });

    const { data: currencies = [] } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.getAll,
    });

    const { data: settings } = useQuery({
        queryKey: ['company-settings'],
        queryFn: companySettingsApi.getSettings,
    });

    // Reference currency for the "Relativo" column and totals. Defaults to USD if no
    // preferred currency is configured, matching the original hardcoded behavior.
    const preferredCurrency =
        currencies.find(c => c.id === settings?.preferredSecondaryCurrencyId) ||
        currencies.find(c => c.code === 'USD') ||
        currencies.find(c => !c.isPrimary);
    const preferredSymbol = preferredCurrency?.symbol || '$';

    // Real symbol of whatever currency the expense was actually paid in (VES, USD,
    // EUR, UDT, etc.) — instead of assuming every non-VES expense is in USD.
    const getCurrencySymbol = (code: string) =>
        currencies.find(c => c.code === code)?.symbol || (code === 'VES' ? 'Bs' : code);

    /**
     * Converts an expense's amount to the preferred reference currency using the
     * exchange rate FROZEN on the record at the time it was created — never today's
     * rate. This mirrors how the amount was actually valued the day it happened.
     */
    const convertToPreferred = (record: Expense) => {
        if (!preferredCurrency) return Number(record.amount);
        if (record.currencyCode === preferredCurrency.code) return Number(record.amount);

        const rate = Number(record.exchangeRate) || 1;

        if (record.currencyCode === 'VES') {
            // exchangeRate stored on the expense = VES per unit of the reference
            // currency that day (e.g. VES per USD).
            return Number(record.amount) / rate;
        }

        // Edge case: the expense was paid in a third currency (e.g. EUR while the
        // preferred currency is USD). We only have that currency's own historical
        // VES rate, not a historical VES rate for the preferred currency on that
        // same date, so this falls back to the preferred currency's CURRENT rate
        // as a best-effort approximation.
        const vesAmount = Number(record.amount) * rate;
        const preferredRateNow = Number(preferredCurrency.exchangeRate) || rate;
        return vesAmount / preferredRateNow;
    };

    const handleSearch = (value: string) => {
        setSearchText(value);
        setCurrentPage(1);
    };

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
     * Sums a list of expenses in the preferred reference currency, using each
     * record's own frozen historical rate (see convertToPreferred).
     */
    const sumInPreferred = (list: Expense[]) =>
        list.reduce((sum, e) => sum + convertToPreferred(e), 0);

    const totalTodayRef = sumInPreferred(
        filteredExpenses.filter(e => dayjs(e.date).isSame(dayjs(), 'day'))
    );

    const totalMonthRef = sumInPreferred(
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
                        {formatVenezuelanPrice(record.amount, getCurrencySymbol(record.currencyCode))}
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
            title: t('expenses_page.relative_usd', { symbol: preferredSymbol }),
            key: 'refAmount',
            align: 'right' as const,
            render: (_: any, record: Expense) => (
                <Typography.Text type="secondary">
                    {formatVenezuelanPrice(convertToPreferred(record), preferredSymbol)}
                </Typography.Text>
            )
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
                                title={t('expenses_page.today_ref', { symbol: preferredSymbol })}
                                value={totalTodayRef}
                                precision={2}
                                styles={{ content: { color: '#cf1322', fontSize: isMobile ? '16px' : '24px' } }}
                                prefix={<DollarOutlined />}
                                suffix={preferredSymbol}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={12} md={6}>
                        <Card size={isMobile ? 'small' : 'default'}>
                            <Statistic
                                title={t('expenses_page.month_ref', { symbol: preferredSymbol })}
                                value={totalMonthRef}
                                precision={2}
                                styles={{ content: { color: '#cf1322', fontSize: isMobile ? '16px' : '24px' } }}
                                prefix={<DollarOutlined />}
                                suffix={preferredSymbol}
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
                            onChange={e => handleSearch(e.target.value)}
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
                {!isMobile ? (
                    <Table
                        columns={columns}
                        dataSource={filteredExpenses}
                        rowKey="id"
                        loading={isLoading}
                        pagination={{
                            current: currentPage,
                            pageSize: pageSize,
                            onChange: (page, size) => {
                                setCurrentPage(page);
                                setPageSize(size);
                            },
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '15', '20', '50', '100'],
                            showTotal: (total, range) => t('common.pagination_total', { rangeStart: range[0], rangeEnd: range[1], total }),
                            position: ['bottomRight']
                        }}
                        scroll={{ x: 'max-content' }}
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {filteredExpenses.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item: Expense) => {
                            const refAmount = convertToPreferred(item);

                            return (
                                <Card
                                    key={item.id}
                                    variant="borderless"
                                    styles={{ body: { padding: 16 } }}
                                    style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', cursor: 'pointer' }}
                                    onClick={() => handleEdit(item)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                        <Text strong style={{ fontSize: 16, color: '#1890ff', flex: 1, marginRight: 8, lineHeight: 1.2 }}>{dayjs(item.date).format('DD/MM/YYYY')}</Text>
                                        <Tag color="blue" style={{ borderRadius: 4 }}>
                                            {t(`expenses.categories.${item.category}`, { defaultValue: item.category })}
                                        </Tag>
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: 15, color: '#cf1322', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>-{formatVenezuelanPrice(item.amount, getCurrencySymbol(item.currencyCode))}</span>
                                        {item.currencyCode !== preferredCurrency?.code && (
                                            <span style={{ fontSize: 12, fontWeight: 'normal', color: '#8c8c8c' }}>
                                                ({formatVenezuelanPrice(refAmount, preferredSymbol)})
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ marginBottom: 12 }}>
                                        <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>
                                            {item.description}
                                        </div>
                                        {item.reference && (
                                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                                                Ref: {item.reference}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#595959' }}>
                                        <DollarOutlined style={{ marginRight: 4 }} />
                                        {t(`expenses.payment_methods.${item.paymentMethod}`, { defaultValue: item.paymentMethod })}
                                        {item.bankAccount && ` • ${item.bankAccount.bankName}`}
                                    </div>
                                </Card>
                            );
                        })}
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, paddingBottom: 24 }}>
                            <Pagination
                                current={currentPage}
                                total={filteredExpenses.length}
                                pageSize={pageSize}
                                onChange={(page) => {
                                    setCurrentPage(page);
                                }}
                                showSizeChanger={false}
                            />
                        </div>
                    </div>
                )}
            </Card>

            <CreateExpenseModal
                open={isCreateModalOpen}
                onCancel={() => setIsCreateModalOpen(false)}
                expense={editingExpense}
            />
        </div>
    );
};
