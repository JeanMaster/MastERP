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

/**
 * CashCountModal Component
 * Handles the physical cash count process for session opening (verification) or closing.
 */
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
                    message.warning('No exchange rate found for USD. Using 0.');
                }
            }
        } catch (error) {
            console.error(error);
            message.error('Error loading cash count data');
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

        const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
        const totalEquivalent = round(totalVES + (totalUSD * exchangeRate));
        return { totalVES, totalUSD, totalEquivalent };
    };

    const handleSubmit = async () => {
        const { totalEquivalent } = calculateTotal();
        const baseAmount = mode === 'OPENING' ? openingBalance : (expectedBalance || 0);
        const diff = totalEquivalent - baseAmount;

        // If opening, the amount MUST match
        if (mode === 'OPENING' && Math.abs(diff) > 0.01) {
            message.error(`The amount does not match (${diff > 0 ? '+' : ''}${diff.toFixed(2)} Bs). Please verify the cash or contact a supervisor.`);
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
                message.success('Cash register verified successfully');

                // Invalidate cache before navigating to avoid loops with old data
                await queryClient.invalidateQueries({ queryKey: ['activeSession'] });

                onSuccess();
                navigate('/app/sales/pos');
            } else {
                // CLOSING Mode: Request authorization
                await cashRegisterApi.requestClose(sessionId, {
                    actualBalance: totalEquivalent,
                    closingNotes: `Closing count performed by cashier. Variance: ${diff.toFixed(2)} Bs.`,
                    items,
                    exchangeRate
                });

                // Invalidate cache to reflect status change
                await queryClient.invalidateQueries({ queryKey: ['activeSession'] });

                setIsWaitingApproval(true);
                onSuccess();
                message.success('Closing request sent. The administrator must authorize the closure.');
            }
        } catch (error: any) {
            message.error(error.message || 'Error in cash count process');
        } finally {
            setLoading(false);
        }
    };

    const checkApprovalStatus = async () => {
        try {
            setLoading(true);
            const session = await cashRegisterApi.getSession(sessionId);
            if (session.status === 'CLOSED') {
                message.success('Closure authorized. Exiting...');
                logout();
            } else {
                message.info('The closure has not been authorized yet.');
            }
        } catch (error) {
            message.error('Error verifying closure status');
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
                    { title: 'Denomination', dataIndex: 'label', key: 'label' },
                    {
                        title: 'Quantity',
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
                title="Closure in Progress"
                open={open}
                closable={false}
                footer={[
                    <Button key="verify" type="primary" size="large" onClick={checkApprovalStatus} loading={loading}>
                        Verify Approval
                    </Button>
                ]}
            >
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <SyncOutlined spin style={{ fontSize: 48, color: '#faad14', marginBottom: 20 }} />
                    <Title level={4}>Waiting for confirmation...</Title>
                    <Text type="secondary">
                        Your closing request has been sent to the administrator.
                        Please keep this window open and click "Verify Approval" when you are informed that your count was authorized.
                    </Text>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            title={mode === 'OPENING' ? "Opening Cash Count (Cash Verification)" : "Cash Closure Count"}
            open={open}
            width={800}
            closable={mode === 'CLOSING'} // Allow cancel on closing if they want to keep selling
            onCancel={onCancel}
            maskClosable={false}
            keyboard={false}
            footer={[
                mode === 'CLOSING' && <Button key="cancel" onClick={onCancel}>Continue Selling</Button>,
                <Button key="submit" type="primary" size="large" onClick={handleSubmit} loading={loading}>
                    {mode === 'OPENING' ? 'Confirm Count' : 'Request Cash Closure'}
                </Button>
            ].filter(Boolean)}
        >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Alert
                    message={mode === 'OPENING' ? "Verification Required" : "Closing Count"}
                    description={mode === 'OPENING'
                        ? "Please count the physical cash to confirm the opening amount."
                        : "Count the final cash in drawer to request the session closure."}
                    type="warning"
                    showIcon
                />

                <Row gutter={24}>
                    <Col span={12}>
                        <Title level={5}>Bolívares (VES)</Title>
                        {renderDenominationColumn('VES')}
                    </Col>
                    <Col span={12}>
                        <Title level={5}>Dollars (USD)</Title>
                        {renderDenominationColumn('USD')}
                        <div style={{ marginTop: 10, textAlign: 'right' }}>
                            <Text type="secondary">Exchange Rate: {exchangeRate.toFixed(2)} Bs/USD</Text>
                        </div>
                    </Col>
                </Row>

                <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Statistic title="Total Counted (Bs)" value={totalEquivalent} precision={2} prefix="Bs." />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title={mode === 'OPENING' ? "Opening Balance (System)" : "Expected Balance (System)"}
                                value={mode === 'OPENING' ? openingBalance : (expectedBalance || 0)}
                                precision={2}
                                prefix="Bs."
                            />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title="Difference"
                                value={Math.round((totalEquivalent - (mode === 'OPENING' ? openingBalance : (expectedBalance || 0))) * 100) / 100}
                                precision={2}
                                prefix="Bs."
                                valueStyle={{
                                    color: Math.round((totalEquivalent - (mode === 'OPENING' ? openingBalance : (expectedBalance || 0))) * 100) / 100 !== 0
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
