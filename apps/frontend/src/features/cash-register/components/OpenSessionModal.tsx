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
            message.error('Error al cargar datos iniciales');
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

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const { totalEquivalent } = calculateTotals();

            if (totalEquivalent <= 0) {
                return message.warning('El saldo inicial debe ser mayor a 0. Registre el efectivo en caja.');
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
            message.success('Caja abierta exitosamente');
            setCounts({});
            form.resetFields();
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al abrir caja');
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
                { title: 'Billetes', dataIndex: 'label', key: 'label' },
                {
                    title: 'Cantidad',
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
            title="Apertura de Caja y Arqueo Inicial"
            open={open}
            onCancel={onCancel}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText="Abrir Caja"
            cancelText="Cancelar"
            width={850}
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item
                            name="cashierId"
                            label="Cajero Asignado"
                            rules={[{ required: true, message: 'Selecciona el cajero' }]}
                        >
                            <Select placeholder="Seleccionar cajero">
                                {users.map(user => (
                                    <Select.Option key={user.id} value={user.username}>
                                        {user.name} ({user.username})
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="notes" label="Notas de Apertura">
                            <TextArea rows={1} placeholder="Observaciones..." />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider titlePlacement="left">Conteo de Efectivo en Gaveta</Divider>

                <Alert
                    message="IMPORTANTE"
                    description="Ingrese el efectivo físico que hay en la caja en este momento. El saldo inicial se calculará automáticamente."
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
                        <Title level={5}>Dólares (USD)</Title>
                        {renderDenominationTable('USD')}
                        <div style={{ textAlign: 'right', marginTop: 8 }}>
                            <Text type="secondary">Tasa: {exchangeRate.toFixed(2)} Bs/$</Text>
                            <br />
                            <Text strong>Subtotal USD: Bs. {(totalUSD * exchangeRate).toFixed(2)} ({totalUSD}$)</Text>
                        </div>
                    </Col>
                </Row>

                <div style={{ background: '#f0f2f5', padding: 20, borderRadius: 8, marginTop: 24 }}>
                    <Statistic
                        title="Saldo Inicial Total (Bs.)"
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
