import { useState, useEffect } from 'react';
import { Table, DatePicker, Segmented, Row, Col, Select, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { statsApi, type TopProduct } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import { usePOSStore } from '../../../store/posStore';
import { ReportCurrencySelector } from './ReportCurrencySelector';

const { RangePicker } = DatePicker;



export const TopProductsReport = () => {
    const { currencies, primaryCurrency } = usePOSStore();
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');

    // Find symbol for selected currency
    const currentCurrencyObj = currencies.find(c => c.code === selectedCurrency);
    const currencySymbol = currentCurrencyObj?.symbol || 'Bs';

    // Initialize currency to primary if available
    useEffect(() => {
        if (primaryCurrency && selectedCurrency === 'VES') {
            setSelectedCurrency(primaryCurrency.code);
        }
    }, [primaryCurrency]);

    const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().subtract(30, 'days'),
        dayjs()
    ]);
    const [sortBy, setSortBy] = useState<'units' | 'profit'>('units');
    const [limit, setLimit] = useState(10);

    const { data: products = [], isLoading } = useQuery({
        queryKey: ['top-products', dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'), sortBy, limit, selectedCurrency],
        queryFn: () => statsApi.getTopProducts({
            startDate: dates[0].format('YYYY-MM-DD'),
            endDate: dates[1].format('YYYY-MM-DD'),
            sortBy,
            limit,
            currency: selectedCurrency
        })
    });

    const columns = [
        {
            title: '#',
            key: 'rank',
            width: 60,
            render: (_: any, __: any, index: number) => (
                <div style={{
                    fontWeight: 'bold',
                    color: index < 3 ? '#cf1322' : '#595959',
                    fontSize: index < 3 ? 16 : 14
                }}>
                    {index + 1}
                </div>
            )
        },
        {
            title: 'Producto',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Unidades Vendidas',
            dataIndex: 'units',
            key: 'units',
            sorter: (a: TopProduct, b: TopProduct) => a.units - b.units,
            render: (value: number) => (
                <Tag color="blue" style={{ fontSize: 14 }}>
                    {value}
                </Tag>
            )
        },
        {
            title: 'Ingresos Totales',
            dataIndex: 'revenue',
            key: 'revenue',
            align: 'right' as const,
            render: (value: number) => formatVenezuelanPrice(value, currencySymbol)
        },
        {
            title: 'Costo Total',
            dataIndex: 'totalCost',
            key: 'totalCost',
            align: 'right' as const,
            render: (value: number) => (
                <span style={{ color: '#8c8c8c' }}>
                    {formatVenezuelanPrice(value, currencySymbol)}
                </span>
            )
        },
        {
            title: 'Margen %',
            dataIndex: 'margin',
            key: 'margin',
            align: 'right' as const,
            render: (value: number) => (
                <Tag color={value >= 30 ? 'green' : value >= 15 ? 'orange' : 'red'}>
                    {value.toFixed(2)}%
                </Tag>
            )
        },
        {
            title: 'Ganancia Estimada',
            dataIndex: 'profit',
            key: 'profit',
            align: 'right' as const,
            render: (value: number) => (
                <span style={{
                    color: value >= 0 ? '#389e0d' : '#cf1322',
                    fontWeight: 'bold'
                }}>
                    {formatVenezuelanPrice(value, currencySymbol)}
                </span>
            )
        }
    ];

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} md={8}>
                        <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Rango de Fechas:</label>
                        <RangePicker
                            value={dates}
                            onChange={(vals) => {
                                if (vals && vals[0] && vals[1]) {
                                    setDates([vals[0], vals[1]]);
                                }
                            }}
                            style={{ width: '100%' }}
                            allowClear={false}
                        />
                    </Col>
                    <Col xs={12} md={6}>
                        <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Ordenar por:</label>
                        <Segmented
                            options={[
                                { label: 'Unidades', value: 'units' },
                                { label: 'Ganancia', value: 'profit' }
                            ]}
                            value={sortBy}
                            onChange={(val) => setSortBy(val as 'units' | 'profit')}
                            block
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <ReportCurrencySelector
                            value={selectedCurrency}
                            onChange={setSelectedCurrency}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Mostrar:</label>
                        <Select
                            value={limit}
                            onChange={setLimit}
                            options={[
                                { label: 'Top 10', value: 10 },
                                { label: 'Top 20', value: 20 },
                                { label: 'Top 50', value: 50 },
                                { label: 'Top 100', value: 100 },
                            ]}
                            style={{ width: '100%' }}
                        />
                    </Col>
                </Row>
            </div>

            <Table
                columns={columns}
                dataSource={products}
                rowKey="id"
                loading={isLoading}
                pagination={false}
                bordered
                summary={(pageData) => {
                    const totalProfit = pageData.reduce((acc, curr) => acc + curr.profit, 0);
                    const totalUnits = pageData.reduce((acc, curr) => acc + curr.units, 0);
                    const totalRevenue = pageData.reduce((acc, curr) => acc + curr.revenue, 0);
                    const totalCost = pageData.reduce((acc, curr) => acc + curr.totalCost, 0);
                    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

                    return (
                        <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                            <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
                            <Table.Summary.Cell index={1}>-</Table.Summary.Cell>
                            <Table.Summary.Cell index={2}>
                                {totalUnits} Unidades
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={3} align="right">
                                {formatVenezuelanPrice(totalRevenue, currencySymbol)}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={4} align="right">
                                {formatVenezuelanPrice(totalCost, currencySymbol)}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={5} align="right">
                                {avgMargin.toFixed(2)}%
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={6} align="right">
                                {formatVenezuelanPrice(totalProfit, currencySymbol)}
                            </Table.Summary.Cell>
                        </Table.Summary.Row>
                    );
                }}
            />
        </div>
    );
};
