
import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, message, Row, Col, Switch, Space, Typography } from 'antd';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { banksApi } from '../../../services/banksApi';
import type { BankAccount, UpdateBankAccountDto } from '../../../services/banksApi';
import { currenciesApi } from '../../../services/currenciesApi';

const { Text } = Typography;

interface BankFormModalProps {
    open: boolean;
    bankAccount: BankAccount | null;
    onClose: () => void;
}

export const BankFormModal = ({ open, bankAccount, onClose }: BankFormModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    // Fetch currencies
    const { data: currencies = [] } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.getAll,
        enabled: open,
    });

    const createMutation = useMutation({
        mutationFn: banksApi.create,
        onSuccess: () => {
            message.success('Cuenta bancaria creada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al crear cuenta');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateBankAccountDto }) =>
            banksApi.update(id, dto),
        onSuccess: () => {
            message.success('Cuenta bancaria actualizada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al actualizar cuenta');
        },
    });

    useEffect(() => {
        if (bankAccount) {
            form.setFieldsValue({
                bankName: bankAccount.bankName,
                accountNumber: bankAccount.accountNumber,
                accountType: bankAccount.accountType,
                holderName: bankAccount.holderName,
                holderId: bankAccount.holderId,
                currencyId: bankAccount.currencyId,
                receivesPosLiquidation: bankAccount.receivesPosLiquidation,
                receivesMobilePayment: bankAccount.receivesMobilePayment,
            });
        } else {
            form.resetFields();
            if (currencies.length > 0) {
                const primary = currencies.find(c => c.isPrimary);
                if (primary) form.setFieldValue('currencyId', primary.id);
            }
        }
    }, [bankAccount, form, currencies]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (bankAccount) {
                updateMutation.mutate({ id: bankAccount.id, dto: values });
            } else {
                createMutation.mutate(values);
            }
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Modal
            title={bankAccount ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={bankAccount ? 'Actualizar' : 'Crear'}
            cancelText="Cancelar"
            width={700}
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Banco"
                            name="bankName"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <Input placeholder="Ej: Banesco" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label="Tipo de Recurso"
                            name="accountType"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <Select
                                options={[
                                    { value: 'CHECKING', label: 'Cuenta Corriente' },
                                    { value: 'SAVINGS', label: 'Cuenta de Ahorro' },
                                    { value: 'CASH_VAULT', label: 'Bóveda / Efectivo (Bolso)' },
                                    { value: 'MOBILE_PAYMENT', label: 'Pago Móvil / Wallet' },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={24}>
                        <Form.Item
                            label="Número de Cuenta"
                            name="accountNumber"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <Input placeholder="0134-...." />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Titular"
                            name="holderName"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <Input placeholder="Nombre del titular" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label="Documento (RIF/CI)"
                            name="holderId"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <Input placeholder="V-12345678" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Moneda"
                            name="currencyId"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <Select
                                options={currencies.map(c => ({
                                    value: c.id,
                                    label: `${c.name} (${c.symbol})`
                                }))}
                            />
                        </Form.Item>
                    </Col>
                    {!bankAccount && (
                        <Col span={12}>
                            <Form.Item
                                label="Saldo Inicial"
                                name="initialBalance"
                                rules={[{ type: 'number', min: 0 }]}
                            >
                                <InputNumber style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    )}
                </Row>

                <Row gutter={16} style={{ marginTop: 16 }}>
                    <Col span={24}>
                        <div style={{ backgroundColor: '#f0faff', padding: '16px', borderRadius: '8px', border: '1px solid #91d5ff' }}>
                            <Row gutter={16} align="middle">
                                <Col flex="none">
                                    <Form.Item name="receivesPosLiquidation" valuePropName="checked" noStyle>
                                        <Switch />
                                    </Form.Item>
                                </Col>
                                <Col flex="auto">
                                    <Space direction="vertical" size={0}>
                                        <Text strong>Recibir Liquidaciones de Punto de Venta</Text>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            Si se activa, los pagos con tarjeta del POS se enviarán a esta cuenta como "Saldo en Tránsito".
                                        </Text>
                                    </Space>
                                </Col>
                            </Row>
                        </div>
                    </Col>

                    <Col span={24} style={{ marginTop: 16 }}>
                        <div style={{ backgroundColor: '#f9f0ff', padding: '16px', borderRadius: '8px', border: '1px solid #d3adf7' }}>
                            <Row gutter={16} align="middle">
                                <Col flex="none">
                                    <Form.Item name="receivesMobilePayment" valuePropName="checked" noStyle>
                                        <Switch />
                                    </Form.Item>
                                </Col>
                                <Col flex="auto">
                                    <Space direction="vertical" size={0}>
                                        <Text strong>Recibir Pago Móvil</Text>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            Habilitar para recibir pagos móviles en el POS.
                                        </Text>
                                    </Space>
                                </Col>
                            </Row>
                        </div>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
};
