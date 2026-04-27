import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, message, Row, Col } from 'antd';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { productsApi } from '../../../services/productsApi';
import type { Product, CreateProductDto, UpdateProductDto } from '../../../services/productsApi';
import { departmentsApi } from '../../../services/departmentsApi';
import { currenciesApi } from '../../../services/currenciesApi';

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
            message.success('Service created successfully');
            queryClient.invalidateQueries({ queryKey: ['services'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error creating service');
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateProductDto }) =>
            productsApi.update(id, dto),
        onSuccess: () => {
            message.success('Service updated successfully');
            queryClient.invalidateQueries({ queryKey: ['services'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error updating service');
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
            title={service ? 'Edit Service' : 'New Service'}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={service ? 'Update (F9)' : 'Create (F9)'}
            cancelText="Cancel"
            width={700}
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Code (SKU)"
                            name="sku"
                            rules={[{ required: true, message: 'Required' }]}
                        >
                            <Input placeholder="e.g., SERV-001" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label="Service Name"
                            name="name"
                            rules={[{ required: true, message: 'Required' }]}
                        >
                            <Input placeholder="e.g., PC Maintenance" />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item label="Description" name="description">
                    <Input.TextArea rows={2} placeholder="Service details..." />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Category"
                            name="categoryId"
                            rules={[{ required: true, message: 'Required' }]}
                        >
                            <Select
                                placeholder="Select category"
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
                        <Form.Item label="Subcategory" name="subcategoryId">
                            <Select
                                placeholder="Optional"
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
                            label="Cost (Technical)"
                            name="costPrice"
                            rules={[{ required: true, message: 'Required' }, { type: 'number', min: 0 }]}
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
                            label="Sale Price"
                            name="salePrice"
                            rules={[{ required: true, message: 'Required' }, { type: 'number', min: 0 }]}
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
                            label="Currency"
                            name="currencyId"
                            rules={[{ required: true, message: 'Required' }]}
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
