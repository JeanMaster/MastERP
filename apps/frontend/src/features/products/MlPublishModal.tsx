import { Modal, Select, Form, Typography, Space, Button, App, Card, Row, Col, Input, InputNumber } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mercadolibreApi } from '../../services/mercadolibreApi';
import type { Product } from '../../services/productsApi';
import { ShopOutlined, CloudUploadOutlined, CheckCircleOutlined, SwapOutlined } from '@ant-design/icons';
import { companySettingsApi } from '../../services/companySettingsApi';
import { formatVenezuelanPrice } from '../../utils/formatters';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;
const { TextArea } = Input;

interface MlPublishModalProps {
    open: boolean;
    product: Product | null;
    onClose: () => void;
}

/**
 * MlPublishModal Component
 * Integration modal for publishing products directly to Mercado Libre.
 * Handles category navigation, title optimization, and multi-image selection.
 */
export const MlPublishModal = ({ open, product, onClose }: MlPublishModalProps) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const watchedPrice = Form.useWatch('price', form);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [currentLevelCategories, setCurrentLevelCategories] = useState<{ id: string; name: string }[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(false);

    // Initialize form with product data
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

    /**
     * Loads root categories from Mercado Libre.
     */
    const loadInitialCategories = async () => {
        setLoadingCategories(true);
        try {
            const cats = await mercadolibreApi.getCategories();
            setCurrentLevelCategories(cats);
        } catch (error) {
            message.error(t('mercadolibre.publish_modal.error_load_cats'));
        } finally {
            setLoadingCategories(false);
        }
    };

    /**
     * Handles hierarchical category navigation.
     */
    const handleCategoryLevelSelect = async (categoryId: string) => {
        setLoadingCategories(true);
        try {
            const subcats = await mercadolibreApi.getCategories(categoryId);
            if (subcats && subcats.length > 0) {
                setCurrentLevelCategories(subcats);
            } else {
                // Leaf category reached (final node)
                form.setFieldValue('categoryId', categoryId);
                message.success(t('mercadolibre.publish_modal.success_cat_selected', { id: categoryId }));
            }
        } catch (error) {
            message.error(t('mercadolibre.publish_modal.error_load_subcats'));
        } finally {
            setLoadingCategories(false);
        }
    };

    // Fetch linked ML accounts
    const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
        queryKey: ['ml-accounts'],
        queryFn: mercadolibreApi.getAccounts,
        enabled: open,
    });

    // Fetch settings for currency conversion display
    const { data: companySettings } = useQuery({
        queryKey: ['company-settings'],
        queryFn: companySettingsApi.getSettings,
        enabled: open,
    });

    const publishMutation = useMutation({
        mutationFn: (payload: any) => mercadolibreApi.publishProduct(payload.productId, payload.mlAccountId, payload.overrides),
        onSuccess: () => {
            message.success(t('mercadolibre.messages.link_success'));
            queryClient.invalidateQueries({ queryKey: ['ml-mappings'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            onClose();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('mercadolibre.messages.link_error'));
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
            // Form validation failed
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
                    <span>{t('mercadolibre.publish_modal.title')}</span>
                </Space>
            }
            open={open}
            onCancel={onClose}
            width={800}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    {t('common.cancel')}
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
                    {t('mercadolibre.publish_modal.publish_now')}
                </Button>,
            ]}
        >
            {product && (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Form form={form} layout="vertical">
                        <Card size="small" title="Listing Information" style={{ marginBottom: 16 }}>
                            <Row gutter={16}>
                                <Col span={18}>
                                    <Form.Item
                                        name="title"
                                        label={t('mercadolibre.publish_modal.ml_title')}
                                        rules={[{ required: true }, { max: 60, message: t('mercadolibre.publish_modal.ml_title_max') }]}
                                    >
                                        <Input showCount maxLength={60} />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item
                                        name="price"
                                        label={t('mercadolibre.publish_modal.price')}
                                        rules={[{ required: true }]}
                                        extra={watchedPrice && companySettings && (
                                            <div style={{ color: '#1890ff', fontSize: 13, marginTop: 4 }}>
                                                <SwapOutlined /> {t('common.conversion')}: {(() => {
                                                    const secondaryRate = Number((companySettings as any).preferredSecondaryCurrency?.exchangeRate) || 0;
                                                    const isPrimary = product.currency?.isPrimary;
                                                    const prodRate = Number(product.currency?.exchangeRate) || 1;

                                                    if (isPrimary && secondaryRate > 0) {
                                                        // Convert Primary (Bs) to Secondary ($)
                                                        return `$ ${(watchedPrice / secondaryRate).toFixed(2)}`;
                                                    } else if (!isPrimary && prodRate > 0) {
                                                        // Convert Secondary ($) to Primary (Bs)
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
                                        label={t('mercadolibre.publish_modal.quantity')}
                                        rules={[{ required: true }, { type: 'number', min: 1, max: product.stock, message: t('mercadolibre.publish_modal.quantity_max', { stock: product.stock }) }]}
                                        help={t('mercadolibre.publish_modal.quantity_help', { stock: product.stock })}
                                    >
                                        <InputNumber style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item name="description" label={t('mercadolibre.publish_modal.description')}>
                                <TextArea rows={4} />
                            </Form.Item>
                        </Card>

                        <Card size="small" title="Mercado Libre Category" style={{ marginBottom: 16 }}>
                            <Form.Item
                                name="categoryId"
                                label={t('mercadolibre.publish_modal.category_selected')}
                                rules={[{ required: true, message: t('mercadolibre.publish_modal.category_required') }]}
                            >
                                <Input readOnly placeholder={t('mercadolibre.publish_modal.category_placeholder')} />
                            </Form.Item>

                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Text type="secondary">{t('mercadolibre.publish_modal.category_explore')}</Text>
                                <Select
                                    style={{ width: '100%' }}
                                    placeholder={t('mercadolibre.publish_modal.category_refine')}
                                    loading={loadingCategories}
                                    onChange={handleCategoryLevelSelect}
                                    options={currentLevelCategories.map(c => ({ label: c.name, value: c.id }))}
                                    value={undefined}
                                />
                                <Button type="link" size="small" onClick={loadInitialCategories} style={{ padding: 0 }}>
                                    {t('mercadolibre.publish_modal.category_reset')}
                                </Button>
                            </Space>
                        </Card>

                        <Card size="small" title="Select Images" style={{ marginBottom: 16 }}>
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
                                <Text type="danger">{t('mercadolibre.publish_modal.images_required')}</Text>
                            )}
                        </Card>

                        <Card size="small" title="Account" style={{ background: '#fffbe6' }}>
                            <Form.Item
                                name="mlAccountId"
                                label="Mercado Libre Account"
                                rules={[{ required: true, message: 'Please select an account' }]}
                                style={{ marginBottom: 0 }}
                            >
                                <Select
                                    placeholder={t('mercadolibre.publish_modal.select_account')}
                                    loading={loadingAccounts}
                                    options={accounts.map((acc) => ({
                                        label: acc.username || `User #${acc.mlUserId}`,
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
