import { Modal, Form, Input, Select, message, Table, InputNumber, Row, Col, Typography, Statistic, Alert, Divider } from 'antd';
import { useState, useEffect } from 'react';
import { cashRegisterApi, type OpenSessionDto } from '../../../services/cashRegisterApi';
import { currenciesApi } from '../../../services/currenciesApi';
import { api } from '../../../services/apiConfig';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface OpenSessionModalProps {
    open: boolean;
    registerId: string;
    onCancel: () => void;
    onSuccess: () => void;
}

/**
 * OpenSessionModal Component
 * Modal to handle the opening of a new cash session and initial cash count.
 */
export const OpenSessionModal = ({ open, registerId, onCancel, onSuccess }: OpenSessionModalProps) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [denominations, setDenominations] = useState<any[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [exchangeRate, setExchangeRate] = useState(0);

    useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [usersData, denomsData, currenciesData] = await Promise.all([
                api.get('/users'),
                cashRegisterApi.getDenominations(),
                currenciesApi.getAll()
            ]);
            setUsers(usersData.data);
            setDenominations(denomsData);

            const usd = currenciesData.find(c => c.code === 'USD');
            if (usd && usd.exchangeRate) {
                setExchangeRate(Number(usd.exchangeRate));
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            message.error('Error loading initial data');
        } finally {
            setLoading(false);
        }
    };

    const handleCountChange = (id: string, quantity: number) => {
        setCounts(prev => ({ ...prev, [id]: quantity }));
    };

    const calculateTotals = () => {
        let totalVES = 0;
        let totalUSD = 0;

        denominations.forEach(d => {
            const qty = counts[d.id] || 0;
            if (d.currencyCode === 'VES') {
                totalVES += Number(d.value) * qty;
            } else if (d.currencyCode === 'USD') {
                totalUSD += Number(d.value) * qty;
            }
        });

        const totalEquivalent = totalVES + (totalUSD * exchangeRate);
        return { totalVES, totalUSD, totalEquivalent };
    };

    // F9 Keyboard Shortcut for quick opening
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [open]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const { totalEquivalent } = calculateTotals();

            if (totalEquivalent <= 0) {
                return message.warning('Initial balance must be greater than 0. Please record the cash in drawer.');
            }

            setLoading(true);

            const items = Object.entries(counts)
                .map(([denominationId, quantity]) => ({ denominationId, quantity }))
                .filter(i => i.quantity > 0);

            const dto: OpenSessionDto = {
                registerId,
                openingBalance: totalEquivalent,
                cashierId: values.cashierId,
                openingNotes: values.notes,
                items,
                exchangeRate
            };

            await cashRegisterApi.openSession(dto);
            message.success('Cash opened successfully');
            setCounts({});
            form.resetFields();
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error opening cash register');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const { totalVES, totalUSD, totalEquivalent } = calculateTotals();

    const renderDenominationTable = (currency: string) => (
        <Table
            dataSource={denominations.filter(d => d.currencyCode === currency)}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
                { title: 'Bills', dataIndex: 'label', key: 'label' },
                {
                    title: 'Quantity',
                    key: 'qty',
                    render: (_: any, record: any) => (
                        <InputNumber
                            min={0}
                            value={counts[record.id]}
                            onChange={(val) => handleCountChange(record.id, Number(val))}
                            style={{ width: 60 }}
                        />
                    )
                },
                {
                    title: 'Bs.',
                    key: 'subtotal',
                    align: 'right',
                    render: (_: any, record: any) => {
                        const val = (counts[record.id] || 0) * Number(record.value);
                        return <Text strong>{val.toFixed(2)}</Text>
                    }
                }
            ]}
        />
    );

    return (
        <Modal
            title="Open Cash & Initial Count"
            open={open}
            onCancel={onCancel}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText="Open Cash (F9)"
            cancelText="Cancel"
            width={850}
            forceRender
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item
                            name="cashierId"
                            label="Assigned Cashier"
                            rules={[{ required: true, message: 'Please select a cashier' }]}
                        >
                            <Select placeholder="Select cashier">
                                {users.map(user => (
                                    <Select.Option key={user.id} value={user.username}>
                                        {user.name} ({user.username})
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="notes" label="Opening Notes">
                            <TextArea rows={1} placeholder="Observations..." />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider titlePlacement="left">Cash in Drawer Count</Divider>

                <Alert
                    message="IMPORTANT"
                    description="Enter the physical cash currently in the drawer. The initial balance will be calculated automatically."
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />

                <Row gutter={24}>
                    <Col span={12}>
                        <Title level={5}>Bolívares (VES)</Title>
                        {renderDenominationTable('VES')}
                        <div style={{ textAlign: 'right', marginTop: 8 }}>
                            <Text strong>Subtotal VES: Bs. {totalVES.toFixed(2)}</Text>
                        </div>
                    </Col>
                    <Col span={12}>
                        <Title level={5}>Dollars (USD)</Title>
                        {renderDenominationTable('USD')}
                        <div style={{ textAlign: 'right', marginTop: 8 }}>
                            <Text type="secondary">Rate: {exchangeRate.toFixed(2)} Bs/$</Text>
                            <br />
                            <Text strong>Subtotal USD: Bs. {(totalUSD * exchangeRate).toFixed(2)} ({totalUSD}$)</Text>
                        </div>
                    </Col>
                </Row>

                <div style={{ background: '#f0f2f5', padding: 20, borderRadius: 8, marginTop: 24 }}>
                    <Statistic
                        title="Total Initial Balance (Bs.)"
                        value={totalEquivalent}
                        precision={2}
                        prefix="Bs."
                        valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                    />
                </div>
            </Form>
        </Modal>
    );
};
