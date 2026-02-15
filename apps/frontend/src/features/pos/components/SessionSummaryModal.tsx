import { Modal, Typography, Row, Col, Statistic, Space, Button, Divider, List } from 'antd';
import { ShopOutlined, PrinterOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import type { CashSession } from '../../../services/cashRegisterApi';

const { Text } = Typography;

interface SessionSummaryModalProps {
    open: boolean;
    session: CashSession | null;
    onCancel: () => void;
    onStartClose: () => void;
}

export const SessionSummaryModal = ({ open, session, onCancel, onStartClose }: SessionSummaryModalProps) => {
    if (!session) return null;

    // Calcular resumen de métodos de pago
    const paymentSummary = {
        CASH_VES: 0,
        CASH_USD: 0,
        DEBIT: 0,
        PAGO_MOVIL: 0, // Assume part of DEBIT or specific
        CREDIT: 0,
        TRANSFER: 0,
        OTHER: 0
    };

    let totalSales = 0;

    const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

    session.sales?.forEach(sale => {
        totalSales += Number(sale.total);

        const payments = sale.paymentMethod.split(', ');

        payments.forEach((paymentPart: string) => {
            let method = paymentPart.toUpperCase();
            let amount = Number(sale.total);

            if (paymentPart.includes(':')) {
                const [m, a] = paymentPart.split(':');
                method = m.trim().toUpperCase();
                amount = parseFloat(a);
            }

            if (method === 'CASH') {
                paymentSummary.CASH_VES += amount;
            } else if (method.includes('CURRENCY_USD')) {
                paymentSummary.CASH_USD += amount;
            } else if (method.includes('DEBIT') || method.includes('PAGO_MOVIL') || method.includes('POS')) {
                paymentSummary.DEBIT += amount;
            } else if (method.includes('TRANSFER')) {
                paymentSummary.TRANSFER += amount;
            } else if (method.includes('ACCOUNT_CREDIT') || method.includes('CREDIT')) {
                paymentSummary.CREDIT += amount;
            } else {
                paymentSummary.OTHER += amount;
            }
        });
    });

    totalSales = round(totalSales);
    paymentSummary.CASH_VES = round(paymentSummary.CASH_VES);
    paymentSummary.CASH_USD = round(paymentSummary.CASH_USD);
    paymentSummary.DEBIT = round(paymentSummary.DEBIT);
    paymentSummary.TRANSFER = round(paymentSummary.TRANSFER);
    paymentSummary.CREDIT = round(paymentSummary.CREDIT);
    paymentSummary.OTHER = round(paymentSummary.OTHER);

    // Calcular Efectivo Esperado (Apertura + Ventas Efectivo + Ingresos - Egresos - Retiros)
    // Usamos los movimientos de la sesión para esto, que es más fiable para el flujo de caja
    let expectedCashVES = Number(session.openingBalance);
    session.movements.forEach(m => {
        const amt = Number(m.amount);
        const rate = Number(m.exchangeRate || 1);
        const amtInVES = amt * rate;

        switch (m.type) {
            case 'SALE':
            case 'WITHDRAWAL':
            case 'OPENING':
            case 'ADJUSTMENT':
                if (m.type !== 'OPENING') expectedCashVES += amtInVES;
                break;
            case 'EXPENSE':
            case 'DEPOSIT':
            case 'CLOSING':
            case 'CHANGE':
                expectedCashVES -= amtInVES;
                break;
        }
    });
    expectedCashVES = round(expectedCashVES);

    const paymentMethodsList = [
        { name: 'Efectivo (Bs)', amount: paymentSummary.CASH_VES, color: '#52c41a', symbol: 'Bs' },
        { name: 'Efectivo (USD)', amount: paymentSummary.CASH_USD, color: '#13c2c2', symbol: '$' },
        { name: 'Punto / Débito', amount: paymentSummary.DEBIT, color: '#1890ff', symbol: 'Bs' },
        { name: 'Transferencias', amount: paymentSummary.TRANSFER, color: '#f5222d', symbol: 'Bs' },
        { name: 'Créditos', amount: paymentSummary.CREDIT, color: '#faad14', symbol: 'Bs' },
        { name: 'Otros', amount: paymentSummary.OTHER, color: '#d9d9d9', symbol: 'Bs' },
    ];

    return (
        <Modal
            title={
                <Space>
                    <ShopOutlined />
                    <span>Resumen de Turno (Reporte X)</span>
                </Space>
            }
            open={open}
            onCancel={onCancel}
            width={700}
            footer={[
                <Button key="print" icon={<PrinterOutlined />} onClick={() => window.print()}>
                    Imprimir Reporte
                </Button>,
                <Button key="close-session" danger type="primary" icon={<CloseCircleOutlined />} onClick={onStartClose}>
                    Cerrar Caja
                </Button>,
                <Button key="ok" onClick={onCancel}>
                    Cerrar
                </Button>
            ]}
        >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Row gutter={24}>
                    <Col span={12}>
                        <Statistic
                            title="Total Ventas (Bruto)"
                            value={totalSales}
                            precision={2}
                            prefix="Bs."
                            valueStyle={{ color: '#096dd9' }}
                        />
                    </Col>
                    <Col span={12}>
                        <Statistic
                            title="Efectivo Esperado en Gaveta"
                            value={expectedCashVES}
                            precision={2}
                            prefix="Bs."
                            valueStyle={{ color: '#3f8600', fontWeight: 'bold' }}
                        />
                    </Col>
                </Row>

                <Divider>Desglose por Método de Pago</Divider>

                <List
                    dataSource={paymentMethodsList}
                    renderItem={item => (
                        <List.Item extra={<Text strong style={{ fontSize: 16 }}>{formatVenezuelanPrice(item.amount, item.symbol)}</Text>}>
                            <List.Item.Meta
                                avatar={<div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color, marginTop: 5 }} />}
                                title={item.name}
                            />
                        </List.Item>
                    )}
                />

                <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, border: '1px solid #f0f0f0' }}>
                    <Row justify="space-between">
                        <Col>
                            <Text type="secondary">Cajero asignado:</Text>
                            <Text strong style={{ marginLeft: 8 }}>{session.cashierId}</Text>
                        </Col>
                        <Col>
                            <Text type="secondary">Apertura:</Text>
                            <Text strong style={{ marginLeft: 8 }}>{new Date(session.openedAt).toLocaleString()}</Text>
                        </Col>
                    </Row>
                </div>
            </Space>
        </Modal>
    );
};
