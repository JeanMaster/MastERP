import { Modal, Select, Form, Typography, Space, Button, message, Card, Row, Col, Input, InputNumber } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mercadolibreApi } from '../../services/mercadolibreApi';
import type { Product } from '../../services/productsApi';
import { ShopOutlined, CloudUploadOutlined, CheckCircleOutlined, SwapOutlined } from '@ant-design/icons';
import { companySettingsApi } from '../../services/companySettingsApi';
import { formatVenezuelanPrice } from '../../utils/formatters';
import { useState, useEffect } from 'react';

const { Text } = Typography;
const { TextArea } = Input;

interface MlPublishModalProps {
    open: boolean;
    product: Product | null;
    onClose: () => void;
}

export const MlPublishModal = ({ open, product, onClose }: MlPublishModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const watchedPrice = Form.useWatch('price', form);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [currentLevelCategories, setCurrentLevelCategories] = useState<{ id: string; name: string }[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(false);

    // Initial values
    useEffect(() => {
        if (product && open) {
            form.setFieldsValue({
                title: product.name.substring(0, 60),
                price: product.salePrice,
                availableQuantity: Math.floor(product.stock),
                description: product.description || product.name,
                categoryId: '',
            });
            setSelectedImages(product.images || []);
            loadInitialCategories();
        }
    }, [product, open, form]);

    const loadInitialCategories = async () => {
        setLoadingCategories(true);
        try {
            const cats = await mercadolibreApi.getCategories();
            setCurrentLevelCategories(cats);
        } catch (error) {
            message.error('Error al cargar categorías');
        } finally {
            setLoadingCategories(false);
        }
    };

    const handleCategoryLevelSelect = async (categoryId: string) => {
        setLoadingCategories(true);
        try {
            const subcats = await mercadolibreApi.getCategories(categoryId);
            if (subcats && subcats.length > 0) {
                setCurrentLevelCategories(subcats);
            } else {
                // Leaf category reached
                form.setFieldValue('categoryId', categoryId);
                message.success('Categoría seleccionada: ' + categoryId);
            }
        } catch (error) {
            message.error('Error al cargar subcategorías');
        } finally {
            setLoadingCategories(false);
        }
    };

    // Fetch linked accounts
    const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
        queryKey: ['ml-accounts'],
        queryFn: mercadolibreApi.getAccounts,
        enabled: open,
    });

    const { data: companySettings } = useQuery({
        queryKey: ['company-settings'],
        queryFn: companySettingsApi.getSettings,
        enabled: open,
    });

    const publishMutation = useMutation({
        mutationFn: (payload: any) => mercadolibreApi.publishProduct(payload.productId, payload.mlAccountId, payload.overrides),
        onSuccess: () => {
            message.success('¡Producto publicado exitosamente en Mercado Libre!');
            queryClient.invalidateQueries({ queryKey: ['ml-mappings'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            onClose();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al publicar el producto');
        },
    });

    const handlePublish = async () => {
        try {
            if (!product) return;
            const values = await form.validateFields();
            publishMutation.mutate({
                productId: product.id,
                mlAccountId: values.mlAccountId,
                overrides: {
                    title: values.title,
                    price: values.price,
                    availableQuantity: values.availableQuantity,
                    description: values.description,
                    categoryId: values.categoryId,
                    images: selectedImages,
                }
            });
        } catch (err) {
            // Form validation error
        }
    };

    const toggleImage = (url: string) => {
        setSelectedImages(prev =>
            prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
        );
    };

    return (
        <Modal
            title={
                <Space>
                    <ShopOutlined style={{ color: '#faad14' }} />
                    <span>Publicar en Mercado Libre</span>
                </Space>
            }
            open={open}
            onCancel={onClose}
            width={800}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    Cancelar
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    icon={<CloudUploadOutlined />}
                    loading={publishMutation.isPending}
                    disabled={accounts.length === 0}
                    onClick={handlePublish}
                    style={{ background: '#faad14', borderColor: '#faad14' }}
                >
                    Publicar Ahora
                </Button>,
            ]}
        >
            {product && (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Form form={form} layout="vertical">
                        <Card size="small" title="Información de la Publicación" style={{ marginBottom: 16 }}>
                            <Row gutter={16}>
                                <Col span={18}>
                                    <Form.Item
                                        name="title"
                                        label="Título en Mercado Libre"
                                        rules={[{ required: true }, { max: 60, message: 'Máximo 60 caracteres' }]}
                                    >
                                        <Input showCount maxLength={60} />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item
                                        name="price"
                                        label="Precio"
                                        rules={[{ required: true }]}
                                        extra={watchedPrice && companySettings && (
                                            <div style={{ color: '#1890ff', fontSize: 13, marginTop: 4 }}>
                                                <SwapOutlined /> Conversión: {(() => {
                                                    const secondaryRate = Number((companySettings as any).preferredSecondaryCurrency?.exchangeRate) || 0;
                                                    const isPrimary = product.currency?.isPrimary;
                                                    const prodRate = Number(product.currency?.exchangeRate) || 1;

                                                    if (isPrimary && secondaryRate > 0) {
                                                        // Convert Bs to $
                                                        return `$ ${(watchedPrice / secondaryRate).toFixed(2)}`;
                                                    } else if (!isPrimary && prodRate > 0) {
                                                        // Convert $ to Bs
                                                        return formatVenezuelanPrice(watchedPrice * prodRate, 'Bs');
                                                    }
                                                    return 'N/A';
                                                })()}
                                            </div>
                                        )}
                                    >
                                        <InputNumber style={{ width: '100%' }} prefix={product.currency.symbol} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item
                                        name="availableQuantity"
                                        label="Cantidad a publicar"
                                        rules={[{ required: true }, { type: 'number', min: 1, max: product.stock, message: `Máximo disponible: ${product.stock}` }]}
                                        help={`Stock actual: ${product.stock}`}
                                    >
                                        <InputNumber style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item name="description" label="Descripción">
                                <TextArea rows={4} />
                            </Form.Item>
                        </Card>

                        <Card size="small" title="Categoría de Mercado Libre" style={{ marginBottom: 16 }}>
                            <Form.Item
                                name="categoryId"
                                label="Categoría Seleccionada"
                                rules={[{ required: true, message: 'Debes seleccionar una categoría' }]}
                            >
                                <Input readOnly placeholder="Navega abajo para seleccionar..." />
                            </Form.Item>

                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Text type="secondary">Explorar categorías (niveles sucesivos):</Text>
                                <Select
                                    style={{ width: '100%' }}
                                    placeholder="Selecciona para refinar..."
                                    loading={loadingCategories}
                                    onChange={handleCategoryLevelSelect}
                                    options={currentLevelCategories.map(c => ({ label: c.name, value: c.id }))}
                                    value={undefined}
                                />
                                <Button type="link" size="small" onClick={loadInitialCategories} style={{ padding: 0 }}>
                                    Reiniciar navegación de categorías
                                </Button>
                            </Space>
                        </Card>

                        <Card size="small" title="Seleccionar Imágenes" style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {product.images.map((url, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => toggleImage(url)}
                                        style={{
                                            position: 'relative',
                                            width: 80,
                                            height: 80,
                                            cursor: 'pointer',
                                            border: selectedImages.includes(url) ? '2px solid #faad14' : '1px solid #d9d9d9',
                                            borderRadius: 4,
                                            overflow: 'hidden',
                                            opacity: selectedImages.includes(url) ? 1 : 0.6
                                        }}
                                    >
                                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        {selectedImages.includes(url) && (
                                            <div style={{ position: 'absolute', top: 2, right: 2 }}>
                                                <CheckCircleOutlined style={{ color: '#faad14', fontSize: 16, background: 'white', borderRadius: '50%' }} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {selectedImages.length === 0 && (
                                <Text type="danger">Debes seleccionar al menos una imagen.</Text>
                            )}
                        </Card>

                        <Card size="small" title="Cuenta" style={{ background: '#fffbe6' }}>
                            <Form.Item
                                name="mlAccountId"
                                label="Cuenta de Mercado Libre"
                                rules={[{ required: true, message: 'Por favor selecciona una cuenta' }]}
                                style={{ marginBottom: 0 }}
                            >
                                <Select
                                    placeholder="Elige la cuenta para publicar"
                                    loading={loadingAccounts}
                                    options={accounts.map((acc) => ({
                                        label: acc.username || `Usuario #${acc.mlUserId}`,
                                        value: acc.id,
                                    }))}
                                />
                            </Form.Item>
                        </Card>
                    </Form>
                </Space>
            )}
        </Modal>
    );
};
