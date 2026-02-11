
import { Modal, InputNumber, Button, Table, Typography, Space, Statistic, Row, Col, message, Alert } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { cashRegisterApi } from '../../../services/cashRegisterApi';
import { currenciesApi } from '../../../services/currenciesApi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { useQueryClient } from '@tanstack/react-query';

const { Title, Text } = Typography;

interface CashCountModalProps {
    open: boolean;
    mode: 'OPENING' | 'CLOSING';
    sessionId: string;
    openingBalance: number; // For opening mode
    expectedBalance?: number; // For closing mode
    onSuccess: () => void;
    onCancel?: () => void;
}

export const CashCountModal = ({ open, mode, sessionId, openingBalance, expectedBalance, onSuccess, onCancel }: CashCountModalProps) => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const queryClient = useQueryClient();
    const [denominations, setDenominations] = useState<any[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({}); // denominationId -> quantity
    const [loading, setLoading] = useState(false);
    const [exchangeRate, setExchangeRate] = useState(0);
    const [isWaitingApproval, setIsWaitingApproval] = useState(false);

    useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [denomsData, currenciesData] = await Promise.all([
                cashRegisterApi.getDenominations(),
                currenciesApi.getAll()
            ]);
            setDenominations(denomsData);

            // Find USD rate
            const usd = currenciesData.find(c => c.code === 'USD');
            if (usd && usd.exchangeRate) {
                setExchangeRate(Number(usd.exchangeRate));
            } else {
                // Fallback: try to find any secondary currency
                const secondary = currenciesData.find(c => !c.isPrimary);
                if (secondary && secondary.exchangeRate) {
                    setExchangeRate(Number(secondary.exchangeRate));
                } else {
                    message.warning('No se encontró tasa de cambio para USD. Se usará 0.');
                }
            }
        } catch (error) {
            console.error(error);
            message.error('Error al cargar datos de arqueo');
        } finally {
            setLoading(false);
        }
    };

    const handleCountChange = (id: string, quantity: number) => {
        setCounts(prev => ({ ...prev, [id]: quantity }));
    };

    const calculateTotal = () => {
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
        const { totalEquivalent } = calculateTotal();
        const baseAmount = mode === 'OPENING' ? openingBalance : (expectedBalance || 0);
        const diff = totalEquivalent - baseAmount;

        // Si es apertura, el monto DEBE coincidir
        if (mode === 'OPENING' && Math.abs(diff) > 0.01) {
            message.error(`El monto no coincide (${diff > 0 ? '+' : ''}${diff.toFixed(2)} Bs). Por favor, verifique el efectivo o contacte al supervisor.`);
            return;
        }

        try {
            setLoading(true);
            const items = Object.entries(counts).map(([denominationId, quantity]) => ({
                denominationId,
                quantity
            })).filter(i => i.quantity > 0);

            if (mode === 'OPENING') {
                await cashRegisterApi.verifySession(sessionId, {
                    items,
                    exchangeRate
                });
                message.success('Caja verificada correctamente');

                // Invalidar cache antes de navegar para evitar bucles con datos viejos
                await queryClient.invalidateQueries({ queryKey: ['activeSession'] });

                onSuccess();
                navigate('/sales/pos');
            } else {
                // Modo CIERRE: Solicitar autorización
                await cashRegisterApi.requestClose(sessionId, {
                    actualBalance: totalEquivalent,
                    closingNotes: `Arqueo de cierre realizado por el cajero. Varianza: ${diff.toFixed(2)} Bs.`,
                    items,
                    exchangeRate
                });

                // Invalidar cache para reflejar cambio de estado
                await queryClient.invalidateQueries({ queryKey: ['activeSession'] });

                setIsWaitingApproval(true);
                onSuccess();
                message.success('Solicitud de cierre enviada. El administrador debe autorizar el cierre.');
            }
        } catch (error: any) {
            message.error(error.message || 'Error en el proceso de arqueo');
        } finally {
            setLoading(false);
        }
    };

    const checkApprovalStatus = async () => {
        try {
            setLoading(true);
            const session = await cashRegisterApi.getSession(sessionId);
            if (session.status === 'CLOSED') {
                message.success('Cierre autorizado. Saliendo...');
                logout();
            } else {
                message.info('El cierre aún no ha sido autorizado.');
            }
        } catch (error) {
            message.error('Error al verificar el estado del cierre');
        } finally {
            setLoading(false);
        }
    };

    const { totalVES, totalUSD, totalEquivalent } = calculateTotal();

    const renderDenominationColumn = (currency: string) => {
        return (
            <Table
                dataSource={denominations.filter(d => d.currencyCode === currency)}
                rowKey="id"
                pagination={false}
                size="small"
                loading={loading}
                columns={[
                    { title: 'Denominación', dataIndex: 'label', key: 'label' },
                    {
                        title: 'Cantidad',
                        key: 'qty',
                        render: (_: any, record: any) => (
                            <InputNumber
                                min={0}
                                value={counts[record.id]}
                                onChange={(val) => handleCountChange(record.id, Number(val))}
                                style={{ width: 80 }}
                            />
                        )
                    },
                    {
                        title: 'Subtotal',
                        key: 'subtotal',
                        align: 'right',
                        render: (_: any, record: any) => {
                            const val = (counts[record.id] || 0) * Number(record.value);
                            return <Text>{val.toFixed(2)}</Text>
                        }
                    }
                ]}
                footer={() => (
                    <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        Total {currency}: {currency === 'VES' ? totalVES.toFixed(2) : totalUSD.toFixed(2)}
                    </div>
                )}
            />
        );
    };

    if (isWaitingApproval) {
        return (
            <Modal
                title="Cierre en Proceso"
                open={open}
                closable={false}
                footer={[
                    <Button key="verify" type="primary" size="large" onClick={checkApprovalStatus} loading={loading}>
                        Verificar Aprobación
                    </Button>
                ]}
            >
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <SyncOutlined spin style={{ fontSize: 48, color: '#faad14', marginBottom: 20 }} />
                    <Title level={4}>Esperando confirmación...</Title>
                    <Text type="secondary">
                        Su solicitud de cierre ha sido enviada al administrador.
                        Mantenga esta ventana abierta y presione "Verificar Aprobación" cuando le informen que su arqueo fue autorizado.
                    </Text>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            title={mode === 'OPENING' ? "Arqueo de Apertura (Verificación de Efectivo)" : "Arqueo de Cierre de Caja"}
            open={open}
            width={800}
            closable={mode === 'CLOSING'} // Allow cancel on closing if they want to keep selling
            onCancel={onCancel}
            maskClosable={false}
            keyboard={false}
            footer={[
                mode === 'CLOSING' && <Button key="cancel" onClick={onCancel}>Seguir Vendiendo</Button>,
                <Button key="submit" type="primary" size="large" onClick={handleSubmit} loading={loading}>
                    {mode === 'OPENING' ? 'Confirmar Arqueo' : 'Solicitar Cierre de Caja'}
                </Button>
            ].filter(Boolean)}
        >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Alert
                    message={mode === 'OPENING' ? "Verificación Requerida" : "Arqueo de Cierre"}
                    description={mode === 'OPENING'
                        ? "Por favor, cuente el efectivo físico para confirmar el monto de apertura."
                        : "Cuente el efectivo final en caja para solicitar el cierre de su sesión."}
                    type="warning"
                    showIcon
                />

                <Row gutter={24}>
                    <Col span={12}>
                        <Title level={5}>Bolívares (VES)</Title>
                        {renderDenominationColumn('VES')}
                    </Col>
                    <Col span={12}>
                        <Title level={5}>Dólares (USD)</Title>
                        {renderDenominationColumn('USD')}
                        <div style={{ marginTop: 10, textAlign: 'right' }}>
                            <Text type="secondary">Tasa de Cambio: {exchangeRate.toFixed(2)} Bs/USD</Text>
                        </div>
                    </Col>
                </Row>

                <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Statistic title="Total Contado (Bs)" value={totalEquivalent} precision={2} prefix="Bs." />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title={mode === 'OPENING' ? "Saldo Apertura (Sistema)" : "Saldo Esperado (Sistema)"}
                                value={mode === 'OPENING' ? openingBalance : (expectedBalance || 0)}
                                precision={2}
                                prefix="Bs."
                            />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title="Diferencia"
                                value={totalEquivalent - (mode === 'OPENING' ? openingBalance : (expectedBalance || 0))}
                                precision={2}
                                prefix="Bs."
                                valueStyle={{
                                    color: (totalEquivalent - (mode === 'OPENING' ? openingBalance : (expectedBalance || 0))) !== 0
                                        ? '#ff4d4f'
                                        : '#3f8600'
                                }}
                            />
                        </Col>
                    </Row>
                </div>
            </Space>
        </Modal>
    );
};
