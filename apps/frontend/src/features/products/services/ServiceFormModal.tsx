
import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, message, Row, Col } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../../../services/productsApi';
import type { Product, CreateProductDto, UpdateProductDto } from '../../../services/productsApi';
import { departmentsApi } from '../../../services/departmentsApi';
import { currenciesApi } from '../../../services/currenciesApi';

interface ServiceFormModalProps {
    open: boolean;
    service: Product | null;
    onClose: () => void;
}

export const ServiceFormModal = ({ open, service, onClose }: ServiceFormModalProps) => {
    // We can just refetch if not present or use hooks, but reusing logic:
    // Actually better to use hooks properly
    // ...
    // Let's copy the hook usage from ProductFormModal but simplified

    // Fetch departments
    // const { data: departments = [] } = ... (Instead of re-fetching, I'll just assume they are cached or fetch them)
    // Actually, I should use the proper useQuery hook.

    // ... rewriting correctly below
    return <ServiceFormModalContent open={open} service={service} onClose={onClose} />;
};

// Extracted for cleaner Hook usage
const ServiceFormModalContent = ({ open, service, onClose }: ServiceFormModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

    // Fetch departments
    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: departmentsApi.getAll,
        enabled: open,
    });

    // Fetch currencies
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
            message.success('Servicio creado exitosamente');
            queryClient.invalidateQueries({ queryKey: ['services'] }); // Use 'services' key
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al crear servicio');
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateProductDto }) =>
            productsApi.update(id, dto),
        onSuccess: () => {
            message.success('Servicio actualizado exitosamente');
            queryClient.invalidateQueries({ queryKey: ['services'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al actualizar servicio');
        },
    });

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
            // Defaults
            if (currencies.length > 0) {
                const primary = currencies.find(c => c.isPrimary);
                if (primary) form.setFieldValue('currencyId', primary.id);
            }
        }
    }, [service, form, currencies]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const dto: CreateProductDto = {
                type: 'SERVICE',
                sku: values.sku, // Still needed as unique key
                name: values.name,
                description: values.description,
                categoryId: values.categoryId,
                subcategoryId: values.subcategoryId,
                currencyId: values.currencyId,
                costPrice: values.costPrice || 0,
                salePrice: values.salePrice,
                stock: 0,
                // Optional fields as null/undefined
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
            title={service ? 'Editar Servicio' : 'Nuevo Servicio'}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={service ? 'Actualizar' : 'Crear'}
            cancelText="Cancelar"
            width={700}
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Código (SKU)"
                            name="sku"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <Input placeholder="Ej: SERV-001" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label="Nombre del Servicio"
                            name="name"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <Input placeholder="Ej: Mantenimiento PC" />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item label="Descripción" name="description">
                    <Input.TextArea rows={2} placeholder="Detalles del servicio..." />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Categoría"
                            name="categoryId"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <Select
                                placeholder="Seleccionar"
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
                        <Form.Item label="Subcategoría" name="subcategoryId">
                            <Select
                                placeholder="Opcional"
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
                            label="Costo (Técnico)"
                            name="costPrice"
                            rules={[{ required: true, message: 'Requerido' }, { type: 'number', min: 0 }]}
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
                            label="Precio de Venta"
                            name="salePrice"
                            rules={[{ required: true, message: 'Requerido' }, { type: 'number', min: 0 }]}
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
                            label="Moneda"
                            name="currencyId"
                            rules={[{ required: true, message: 'Requerido' }]}
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
import { useQuery } from '@tanstack/react-query';
