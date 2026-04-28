import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, App, Row, Col } from 'antd';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { productsApi } from '../../../services/productsApi';
import type { Product, CreateProductDto, UpdateProductDto } from '../../../services/productsApi';
import { departmentsApi } from '../../../services/departmentsApi';
import { currenciesApi } from '../../../services/currenciesApi';
import { useTranslation } from 'react-i18next';

interface ServiceFormModalProps {
    open: boolean;
    service: Product | null;
    onClose: () => void;
}

/**
 * ServiceFormModal Component
 * Simplified form for managing services (intangible products).
 */
export const ServiceFormModal = ({ open, service, onClose }: ServiceFormModalProps) => {
    return <ServiceFormModalContent open={open} service={service} onClose={onClose} />;
};

/**
 * Internal component to handle hook lifecycle properly.
 */
const ServiceFormModalContent = ({ open, service, onClose }: ServiceFormModalProps) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

    // Fetch categorization data
    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: departmentsApi.getAll,
        enabled: open,
    });

    // Fetch currencies for pricing
    const { data: currencies = [] } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.getAll,
        enabled: open,
    });

    const categories = departments.filter(d => !d.parentId);
    const subcategories = departments.filter(d => d.parentId === selectedCategory);

    // Create mutation
    const createMutation = useMutation({
        mutationFn: productsApi.create,
        onSuccess: () => {
            message.success(t('products.services.success_create'));
            queryClient.invalidateQueries({ queryKey: ['services'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('products.services.error_create'));
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateProductDto }) =>
            productsApi.update(id, dto),
        onSuccess: () => {
            message.success(t('products.services.success_update'));
            queryClient.invalidateQueries({ queryKey: ['services'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('products.services.error_update'));
        },
    });

    // Load initial values or reset
    useEffect(() => {
        if (service) {
            setSelectedCategory(service.categoryId);
            form.setFieldsValue({
                sku: service.sku,
                name: service.name,
                description: service.description,
                categoryId: service.categoryId,
                subcategoryId: service.subcategoryId,
                currencyId: service.currencyId,
                costPrice: service.costPrice,
                salePrice: service.salePrice,
            });
        } else {
            setSelectedCategory(undefined);
            form.resetFields();
            if (currencies.length > 0) {
                const primary = currencies.find(c => c.isPrimary);
                if (primary) form.setFieldValue('currencyId', primary.id);
            }
        }
    }, [service, form, currencies, open]);

    // F9 Keyboard Shortcut
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
    }, [open, form]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const dto: CreateProductDto = {
                type: 'SERVICE',
                sku: values.sku,
                name: values.name,
                description: values.description,
                categoryId: values.categoryId,
                subcategoryId: values.subcategoryId,
                currencyId: values.currencyId,
                costPrice: values.costPrice || 0,
                salePrice: values.salePrice,
                stock: 0,
            };

            if (service) {
                updateMutation.mutate({ id: service.id, dto });
            } else {
                createMutation.mutate(dto);
            }
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const handleCategoryChange = (value: string) => {
        setSelectedCategory(value);
        form.setFieldValue('subcategoryId', undefined);
    };

    return (
        <Modal
            title={service ? t('products.services.edit') : t('products.services.new')}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={service ? `${t('common.save')} (F9)` : `${t('common.add')} (F9)`}
            cancelText={t('common.cancel')}
            width={700}
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={t('products.finished.sku')}
                            name="sku"
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Input placeholder={t('products.services.sku_placeholder')} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={t('products.services.name')}
                            name="name"
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Input placeholder={t('products.services.name_placeholder')} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item label={t('common.description')} name="description">
                    <Input.TextArea rows={2} placeholder={t('common.description') + '...'} />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={t('common.category')}
                            name="categoryId"
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Select
                                placeholder={t('common.category')}
                                onChange={handleCategoryChange}
                                showSearch
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                                options={categories.map(cat => ({
                                    value: cat.id,
                                    label: cat.name,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label={t('departments.parent')} name="subcategoryId">
                            <Select
                                placeholder={t('common.no')}
                                allowClear
                                disabled={!selectedCategory}
                                options={subcategories.map(subcat => ({
                                    value: subcat.id,
                                    label: subcat.name,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item
                            label={t('products.services.cost_technical')}
                            name="costPrice"
                            rules={[{ required: true, message: t('common.error') }, { type: 'number', min: 0 }]}
                        >
                            <InputNumber
                                style={{ width: '100%' }}
                                precision={2}
                                min={0}
                                placeholder="0.00"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item
                            label={t('common.price')}
                            name="salePrice"
                            rules={[{ required: true, message: t('common.error') }, { type: 'number', min: 0 }]}
                        >
                            <InputNumber
                                style={{ width: '100%' }}
                                precision={2}
                                min={0}
                                placeholder="0.00"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item
                            label={t('common.payment_currency')}
                            name="currencyId"
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Select
                                options={currencies.map(curr => ({
                                    value: curr.id,
                                    label: `${curr.code} (${curr.symbol})`,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
};
