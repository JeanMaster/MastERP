import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, message, Row, Col, Divider, Card, Alert, Upload, Button, Switch } from 'antd';
import { PlusOutlined, NodeIndexOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../../services/productsApi';
import type { Product, CreateProductDto, UpdateProductDto } from '../../services/productsApi';
import { departmentsApi } from '../../services/departmentsApi';
import { currenciesApi } from '../../services/currenciesApi';
import { unitsApi } from '../../services/unitsApi';
import { PriceUpdateConfirmModal } from '../purchases/components/PriceUpdateConfirmModal';
import { companySettingsApi } from '../../services/companySettingsApi';

interface ProductFormModalProps {
    open: boolean;
    product: Product | null;
    onClose: () => void;
    defaultType?: 'PRODUCT' | 'SERVICE' | 'COMPOSED';
}

/**
 * ProductFormModal Component
 * Comprehensive form for managing products, services, and composed products (recipes).
 * Handles multi-currency pricing, unit conversions (primary/secondary), and inventory tracking.
 */
export const ProductFormModal = ({ open, product, onClose, defaultType }: ProductFormModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
    const [hasSecondaryUnit, setHasSecondaryUnit] = useState(false);
    const [conversionDirection, setConversionDirection] = useState<string>('primary_to_secondary');
    const [images, setImages] = useState<string[]>([]);
    const [priceUpdateModalVisible, setPriceUpdateModalVisible] = useState(false);
    const [costChangeInfo, setCostChangeInfo] = useState<any>(null);
    const [priceUpdateLoading, setPriceUpdateLoading] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState<any>(null);
    const [similarProductSearch, setSimilarProductSearch] = useState<string>('');
    const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
    const [isSearchingSimilar, setIsSearchingSimilar] = useState(false);
    const [productType, setProductType] = useState<'PRODUCT' | 'SERVICE' | 'COMPOSED' | undefined>(undefined);
    const [, setIngredientSearch] = useState<string>('');
    const [availableIngredients, setAvailableIngredients] = useState<Product[]>([]);
    const [, setIsSearchingIngredients] = useState(false);

    // Fetch departments for categorization
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

    // Fetch measurement units
    const { data: units = [] } = useQuery({
        queryKey: ['units'],
        queryFn: unitsApi.getAll,
        enabled: open,
    });

    // Fetch company settings for tax configuration
    const { data: settings } = useQuery({
        queryKey: ['company-settings'],
        queryFn: companySettingsApi.getSettings,
        enabled: open,
    });

    const categories = departments.filter(d => !d.parentId);
    const subcategories = departments.filter(d => d.parentId === selectedCategory);

    // Create mutation
    const createMutation = useMutation({
        mutationFn: productsApi.create,
        onSuccess: () => {
            message.success('Product created successfully');
            queryClient.invalidateQueries({ queryKey: ['products'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error creating product');
        },
    });

    // Update mutation with cost change detection logic
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateProductDto }) =>
            productsApi.update(id, dto),
        onSuccess: (data: any) => {
            // If backend detects a cost change that impacts margins, show a secondary confirmation modal
            if (data.costChangeDetected && data.costChangeInfo) {
                setCostChangeInfo(data.costChangeInfo);
                setPriceUpdateModalVisible(true);
            } else {
                message.success('Product updated successfully');
                queryClient.invalidateQueries({ queryKey: ['products'] });
                onClose();
                form.resetFields();
            }
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error updating product');
        },
    });

    // Initialize or reset form data
    useEffect(() => {
        if (product) {
            setSelectedCategory(product.categoryId);

            // Calculate initial profit margins
            const costPrice = product.costPrice;
            const saleProfitPercent = costPrice > 0 ? ((product.salePrice - costPrice) / costPrice) * 100 : 0;
            const offerProfitPercent = product.offerPrice && costPrice > 0
                ? ((product.offerPrice - costPrice) / costPrice) * 100
                : 0;
            const wholesaleProfitPercent = product.wholesalePrice && costPrice > 0
                ? ((product.wholesalePrice - costPrice) / costPrice) * 100
                : 0;

            // Secondary unit margins
            const secondaryCost = product.secondaryCostPrice || 0;
            const secondarySaleProfitPercent = product.secondarySalePrice && secondaryCost > 0
                ? ((product.secondarySalePrice - secondaryCost) / secondaryCost) * 100
                : 0;
            const secondaryOfferProfitPercent = product.secondaryOfferPrice && secondaryCost > 0
                ? ((product.secondaryOfferPrice - secondaryCost) / secondaryCost) * 100
                : 0;
            const secondaryWholesaleProfitPercent = product.secondaryWholesalePrice && secondaryCost > 0
                ? ((product.secondaryWholesalePrice - secondaryCost) / secondaryCost) * 100
                : 0;

            setHasSecondaryUnit(!!product.secondaryUnitId);
            setConversionDirection(product.conversionDirection || 'primary_to_secondary');
            setImages(product.images || []);

            form.setFieldsValue({
                sku: product.sku,
                name: product.name,
                description: product.description,
                categoryId: product.categoryId,
                subcategoryId: product.subcategoryId,
                currencyId: product.currencyId,
                unitId: product.unitId,
                secondaryUnitId: product.secondaryUnitId,
                unitsPerSecondaryUnit: product.unitsPerSecondaryUnit,
                conversionDirection: product.conversionDirection || 'primary_to_secondary',
                costPrice: product.costPrice,
                stock: product.stock,
                salePrice: product.salePrice,
                saleProfitPercent: Number(saleProfitPercent.toFixed(2)),
                offerPrice: product.offerPrice,
                offerProfitPercent: Number(offerProfitPercent.toFixed(2)),
                wholesalePrice: product.wholesalePrice,
                wholesaleProfitPercent: Number(wholesaleProfitPercent.toFixed(2)),
                secondaryCostPrice: product.secondaryCostPrice,
                secondarySalePrice: product.secondarySalePrice,
                secondarySaleProfitPercent: Number(secondarySaleProfitPercent.toFixed(2)),
                secondaryOfferPrice: product.secondaryOfferPrice,
                secondaryOfferProfitPercent: Number(secondaryOfferProfitPercent.toFixed(2)),
                secondaryWholesalePrice: product.secondaryWholesalePrice,
                secondaryWholesaleProfitPercent: Number(secondaryWholesaleProfitPercent.toFixed(2)),
                images: product.images || [],
                isTaxExempt: product.isTaxExempt || false,
                type: product.type || 'PRODUCT',
                components: product.components?.map(c => ({
                    componentProductId: c.componentProductId,
                    quantity: c.quantity,
                    cost: c.componentProduct.costPrice,
                    stock: c.componentProduct.stock,
                    rate: c.componentProduct.currency?.isPrimary ? 1 : Number(c.componentProduct.currency?.exchangeRate || 1)
                })) || []
            });

            setProductType(product.type || 'PRODUCT');

            if (product.currency) {
                setSelectedCurrency(product.currency);
            }

            if (product.type === 'COMPOSED' && product.components) {
                setAvailableIngredients(product.components.map(c => (c as any).componentProduct));
            }
        } else {
            form.resetFields();
            const type = defaultType || 'PRODUCT';
            form.setFieldValue('type', type);
            setProductType(type);
            setSelectedCategory(undefined);
            setHasSecondaryUnit(false);
            setConversionDirection('primary_to_secondary');
            setImages([]);
            setSelectedCurrency(null);
            form.setFieldValue('isTaxExempt', false);
        }
    }, [product, form, open, defaultType]);

    // Keyboard Shortcuts (F9 to Submit)
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
                sku: values.sku,
                name: values.name,
                description: values.description,
                categoryId: values.categoryId,
                subcategoryId: values.subcategoryId,
                currencyId: values.currencyId,
                costPrice: values.costPrice,
                salePrice: values.salePrice,
                offerPrice: values.offerPrice,
                wholesalePrice: values.wholesalePrice,
                stock: values.stock || 0,
                unitId: values.unitId,
                secondaryUnitId: values.secondaryUnitId,
                unitsPerSecondaryUnit: values.unitsPerSecondaryUnit,
                conversionDirection: values.conversionDirection,
                secondaryCostPrice: values.secondaryCostPrice,
                secondarySalePrice: values.secondarySalePrice,
                secondaryOfferPrice: values.secondaryOfferPrice,
                secondaryWholesalePrice: values.secondaryWholesalePrice,
                images: images,
                isTaxExempt: values.isTaxExempt || false,
                type: values.type,
                components: values.type === 'COMPOSED' ? values.components?.map((c: any) => ({
                    componentProductId: c.componentProductId,
                    quantity: c.quantity
                })) : undefined
            };

            if (product) {
                updateMutation.mutate({ id: product.id, dto });
            } else {
                createMutation.mutate(dto);
            }
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    /**
     * Handles batch price updates if cost changes were confirmed by the user.
     */
    const handlePriceUpdateConfirm = async () => {
        try {
            setPriceUpdateLoading(true);
            if (costChangeInfo) {
                const updates = [{
                    productId: costChangeInfo.productId,
                    newCostPrice: costChangeInfo.newCost,
                    salePriceMargin: costChangeInfo.salePriceMargin,
                    offerPriceMargin: costChangeInfo.offerPriceMargin,
                    wholesalePriceMargin: costChangeInfo.wholesalePriceMargin,
                }];

                await productsApi.batchUpdatePrices(updates);
                message.success('Prices updated successfully');

                setPriceUpdateModalVisible(false);
                await queryClient.invalidateQueries({ queryKey: ['products'] });

                form.resetFields();
                setTimeout(() => {
                    onClose();
                }, 100);
            }
        } catch (error) {
            console.error(error);
            message.error('Error updating prices');
        } finally {
            if (open) setPriceUpdateLoading(false);
        }
    };

    const handlePriceUpdateCancel = () => {
        setPriceUpdateModalVisible(false);
        message.success('Product updated (prices unchanged)');
        queryClient.invalidateQueries({ queryKey: ['products'] });
        form.resetFields();
        setTimeout(() => {
            onClose();
        }, 100);
    };

    const handleCategoryChange = (value: string) => {
        setSelectedCategory(value);
        form.setFieldValue('subcategoryId', undefined);
    };

    const handleSearchSimilar = (value: string) => {
        setSimilarProductSearch(value);
        if (value.length > 2) {
            setIsSearchingSimilar(true);
            productsApi.getAll({ search: value, limit: 10 }).then(data => {
                const filtered = data.filter((p: Product) => p.id !== product?.id);
                setSimilarProducts(filtered);
                setIsSearchingSimilar(false);
            }).catch(() => {
                setIsSearchingSimilar(false);
            });
        } else {
            setSimilarProducts([]);
        }
    };

    /**
     * Clones pricing configuration from another product.
     */
    const handleImportFromProduct = (productId: string) => {
        const found = similarProducts.find(p => p.id === productId);
        if (!found) return;

        Modal.confirm({
            title: 'Import price configuration?',
            content: `The currency, cost, and sales prices from "${found.name}" will be copied. Current values will be overwritten.`,
            onOk: () => {
                const costPrice = found.costPrice;
                const saleProfitPercent = costPrice > 0 ? ((found.salePrice - costPrice) / costPrice) * 100 : 0;
                const offerProfitPercent = found.offerPrice && costPrice > 0
                    ? ((found.offerPrice - costPrice) / costPrice) * 100
                    : 0;
                const wholesaleProfitPercent = found.wholesalePrice && costPrice > 0
                    ? ((found.wholesalePrice - costPrice) / costPrice) * 100
                    : 0;

                form.setFieldsValue({
                    currencyId: found.currencyId,
                    costPrice: found.costPrice,
                    salePrice: found.salePrice,
                    saleProfitPercent: Number(saleProfitPercent.toFixed(2)),
                    offerPrice: found.offerPrice,
                    offerProfitPercent: Number(offerProfitPercent.toFixed(2)),
                    wholesalePrice: found.wholesalePrice,
                    wholesaleProfitPercent: Number(wholesaleProfitPercent.toFixed(2)),
                    secondaryCostPrice: found.secondaryCostPrice,
                    secondarySalePrice: found.secondarySalePrice,
                    secondaryOfferPrice: found.secondaryOfferPrice,
                    secondaryWholesalePrice: found.secondaryWholesalePrice,
                });

                if (found.currency) {
                    setSelectedCurrency(found.currency);
                }

                message.success('Price information imported');
                setSimilarProducts([]);
                setSimilarProductSearch('');
            }
        });
    };

    // Helper functions for margin calculations
    const calculatePriceFromPercent = (costPrice: number, percent: number): number => {
        return costPrice + (costPrice * percent / 100);
    };

    const calculatePercentFromPrice = (costPrice: number, salePrice: number): number => {
        if (costPrice === 0) return 0;
        return ((salePrice - costPrice) / costPrice) * 100;
    };

    // Price change handlers
    const handleSalePriceChange = (value: number | null) => {
        if (value !== null) {
            const costPrice = form.getFieldValue('costPrice') || 0;
            const percent = calculatePercentFromPrice(costPrice, value);
            form.setFieldValue('saleProfitPercent', Number(percent.toFixed(2)));
        }
    };

    const handleSaleProfitPercentChange = (value: number | null) => {
        if (value !== null) {
            const costPrice = form.getFieldValue('costPrice') || 0;
            const price = calculatePriceFromPercent(costPrice, value);
            form.setFieldValue('salePrice', Number(price.toFixed(2)));
        }
    };

    const handleOfferPriceChange = (value: number | null) => {
        if (value !== null) {
            const costPrice = form.getFieldValue('costPrice') || 0;
            const percent = calculatePercentFromPrice(costPrice, value);
            form.setFieldValue('offerProfitPercent', Number(percent.toFixed(2)));
        }
    };

    const handleOfferProfitPercentChange = (value: number | null) => {
        if (value !== null) {
            const costPrice = form.getFieldValue('costPrice') || 0;
            const price = calculatePriceFromPercent(costPrice, value);
            form.setFieldValue('offerPrice', Number(price.toFixed(2)));
        }
    };

    const handleWholesalePriceChange = (value: number | null) => {
        if (value !== null) {
            const costPrice = form.getFieldValue('costPrice') || 0;
            const percent = calculatePercentFromPrice(costPrice, value);
            form.setFieldValue('wholesaleProfitPercent', Number(percent.toFixed(2)));
        }
    };

    const handleWholesaleProfitPercentChange = (value: number | null) => {
        if (value !== null) {
            const costPrice = form.getFieldValue('costPrice') || 0;
            const price = calculatePriceFromPercent(costPrice, value);
            form.setFieldValue('wholesalePrice', Number(price.toFixed(2)));
        }
    };

    // Unit conversion handlers
    const handleSecondaryUnitChange = (value: string | undefined) => {
        setHasSecondaryUnit(!!value);
        if (value) {
            calculateSecondaryPrices();
        } else {
            form.setFieldsValue({
                unitsPerSecondaryUnit: undefined,
                conversionDirection: 'primary_to_secondary',
                secondaryCostPrice: undefined,
                secondarySalePrice: undefined,
                secondaryOfferPrice: undefined,
                secondaryWholesalePrice: undefined,
            });
        }
    };

    const handleUnitsPerSecondaryChange = () => {
        calculateSecondaryPrices();
    };

    /**
     * Automatically calculates secondary unit prices based on primary unit prices and conversion rate.
     */
    const calculateSecondaryPrices = () => {
        const unitsPerSecondary = form.getFieldValue('unitsPerSecondaryUnit');
        const direction = form.getFieldValue('conversionDirection');

        if (!unitsPerSecondary) return;

        const costPrice = form.getFieldValue('costPrice') || 0;
        const salePrice = form.getFieldValue('salePrice');
        const offerPrice = form.getFieldValue('offerPrice');
        const wholesalePrice = form.getFieldValue('wholesalePrice');

        const calculateVal = (val: number) => {
            if (direction === 'secondary_to_primary') {
                return Number((val / unitsPerSecondary).toFixed(2));
            }
            return Number((val * unitsPerSecondary).toFixed(2));
        };

        const secondaryCost = calculateVal(costPrice);
        form.setFieldValue('secondaryCostPrice', secondaryCost);

        if (salePrice) {
            const secondarySale = calculateVal(salePrice);
            const secondarySalePercent = secondaryCost > 0
                ? calculatePercentFromPrice(secondaryCost, secondarySale)
                : 0;
            form.setFieldValue('secondarySalePrice', secondarySale);
            form.setFieldValue('secondarySaleProfitPercent', Number(secondarySalePercent.toFixed(2)));
        }
        if (offerPrice) {
            const secondaryOffer = calculateVal(offerPrice);
            const secondaryOfferPercent = secondaryCost > 0
                ? calculatePercentFromPrice(secondaryCost, secondaryOffer)
                : 0;
            form.setFieldValue('secondaryOfferPrice', secondaryOffer);
            form.setFieldValue('secondaryOfferProfitPercent', Number(secondaryOfferPercent.toFixed(2)));
        }
        if (wholesalePrice) {
            const secondaryWholesale = calculateVal(wholesalePrice);
            const secondaryWholesalePercent = secondaryCost > 0
                ? calculatePercentFromPrice(secondaryCost, secondaryWholesale)
                : 0;
            form.setFieldValue('secondaryWholesalePrice', secondaryWholesale);
            form.setFieldValue('secondaryWholesaleProfitPercent', Number(secondaryWholesalePercent.toFixed(2)));
        }
    };

    // Secondary unit price change handlers
    const handleSecondarySalePriceChange = (value: number | null) => {
        if (value !== null) {
            const secondaryCost = form.getFieldValue('secondaryCostPrice') || 0;
            const percent = calculatePercentFromPrice(secondaryCost, value);
            form.setFieldValue('secondarySaleProfitPercent', Number(percent.toFixed(2)));
        }
    };

    const handleSecondarySaleProfitPercentChange = (value: number | null) => {
        if (value !== null) {
            const secondaryCost = form.getFieldValue('secondaryCostPrice') || 0;
            const price = calculatePriceFromPercent(secondaryCost, value);
            form.setFieldValue('secondarySalePrice', Number(price.toFixed(2)));
        }
    };

    const handleSecondaryOfferPriceChange = (value: number | null) => {
        if (value !== null) {
            const secondaryCost = form.getFieldValue('secondaryCostPrice') || 0;
            const percent = calculatePercentFromPrice(secondaryCost, value);
            form.setFieldValue('secondaryOfferProfitPercent', Number(percent.toFixed(2)));
        }
    };

    const handleSecondaryOfferProfitPercentChange = (value: number | null) => {
        if (value !== null) {
            const secondaryCost = form.getFieldValue('secondaryCostPrice') || 0;
            const price = calculatePriceFromPercent(secondaryCost, value);
            form.setFieldValue('secondaryOfferPrice', Number(price.toFixed(2)));
        }
    };

    const handleSecondaryWholesalePriceChange = (value: number | null) => {
        if (value !== null) {
            const secondaryCost = form.getFieldValue('secondaryCostPrice') || 0;
            const percent = calculatePercentFromPrice(secondaryCost, value);
            form.setFieldValue('secondaryWholesaleProfitPercent', Number(percent.toFixed(2)));
        }
    };

    const handleSecondaryWholesaleProfitPercentChange = (value: number | null) => {
        if (value !== null) {
            const secondaryCost = form.getFieldValue('secondaryCostPrice') || 0;
            const price = calculatePriceFromPercent(secondaryCost, value);
            form.setFieldValue('secondaryWholesalePrice', Number(price.toFixed(2)));
        }
    };

    const handleIngredientSearch = (value: string) => {
        setIngredientSearch(value);
        if (value.length > 1) {
            setIsSearchingIngredients(true);
            productsApi.getAll({ search: value, limit: 10, type: 'PRODUCT' }).then(data => {
                setAvailableIngredients(data);
                setIsSearchingIngredients(false);
            }).catch(() => {
                setIsSearchingIngredients(false);
            });
        }
    };

    /**
     * Recalculates total cost and overall availability for composed products (recipes).
     */
    const updateComposedFields = () => {
        const components = form.getFieldValue('components') || [];
        let totalCostInBase = 0;
        const availabilities: number[] = [];

        components.forEach((c: any) => {
            if (c.cost !== undefined) {
                const rate = c.rate || 1;
                totalCostInBase += (Number(c.cost) * rate) * (c.quantity || 0);
            }
            if (c.stock !== undefined && (c.quantity > 0)) {
                availabilities.push(Math.floor(Number(c.stock) / Number(c.quantity)));
            }
        });

        const targetCurrencyId = form.getFieldValue('currencyId');
        const targetCurrency = currencies.find(curr => curr.id === targetCurrencyId);
        const targetRate = targetCurrency?.isPrimary ? 1 : Number(targetCurrency?.exchangeRate || 1);

        form.setFieldValue('costPrice', Number((totalCostInBase / targetRate).toFixed(2)));

        if (availabilities.length > 0) {
            const calculatedStock = Math.min(...availabilities);
            form.setFieldValue('stock', calculatedStock);
        } else if (components.length > 0) {
            form.setFieldValue('stock', 0);
        }

        handleSalePriceChange(form.getFieldValue('salePrice'));
    };

    return (
        <>
            <Modal
                title={product ? 'Edit Product' : 'New Product'}
                open={open}
                onOk={handleSubmit}
                onCancel={onClose}
                confirmLoading={createMutation.isPending || updateMutation.isPending}
                okText={product ? 'Update (F9)' : 'Create (F9)'}
                cancelText="Cancel"
                width={900}
            >
                <Form
                    form={form}
                    layout="vertical"
                    style={{ marginTop: 20 }}
                    onValuesChange={(changedValues) => {
                        if (changedValues.currencyId) {
                            const currency = currencies.find(c => c.id === changedValues.currencyId);
                            setSelectedCurrency(currency);
                        }
                    }}
                >
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                label="Product Type"
                                name="type"
                                rules={[{ required: true }]}
                            >
                                <Select
                                    onChange={(val) => setProductType(val)}
                                    options={[
                                        { value: 'PRODUCT', label: 'Finished Product' },
                                        { value: 'SERVICE', label: 'Service' },
                                        { value: 'COMPOSED', label: 'Composed Product (Recipe)' },
                                    ]}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="SKU"
                                name="sku"
                                rules={[{ required: true, message: 'SKU is required' }]}
                            >
                                <Input placeholder="e.g., PROD-001" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Name"
                                name="name"
                                rules={[{ required: true, message: 'Name is required' }]}
                            >
                                <Input placeholder="e.g., Hammer 16oz" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label="Description" name="description">
                        <Input.TextArea rows={2} placeholder="Product description..." />
                    </Form.Item>

                    {settings?.taxEnabled && (
                        <Form.Item name="isTaxExempt" valuePropName="checked">
                            <Switch checkedChildren="Tax EXEMPT Product" unCheckedChildren="Taxable Product" />
                        </Form.Item>
                    )}

                    <Form.Item label="Product Images (Max 12)">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {images.map((url, index) => (
                                <div key={index} style={{ position: 'relative', width: 100, height: 100, border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden' }}>
                                    <img src={url} alt={`Image ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <div
                                        style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(255, 77, 79, 0.8)', color: 'white', padding: '2px 6px', cursor: 'pointer', borderRadius: '0 0 0 8px' }}
                                        onClick={() => setImages(prev => prev.filter((_, i) => i !== index))}
                                    >
                                        <DeleteOutlined />
                                    </div>
                                </div>
                            ))}
                            {images.length < 12 && (
                                <Upload
                                    name="image"
                                    listType="picture-card"
                                    showUploadList={false}
                                    beforeUpload={async (file) => {
                                        if (images.length >= 12) {
                                            message.warning('Maximum 12 images allowed');
                                            return false;
                                        }
                                        try {
                                            const maxWidth = 1000;
                                            const maxHeight = 1000;
                                            const quality = 0.8;

                                            const compressImage = (file: File): Promise<string> => {
                                                return new Promise((resolve, reject) => {
                                                    const reader = new FileReader();
                                                    reader.readAsDataURL(file);
                                                    reader.onload = (event) => {
                                                        const img = document.createElement('img');
                                                        img.src = event.target?.result as string;
                                                        img.onload = () => {
                                                            let width = img.width;
                                                            let height = img.height;
                                                            if (width > height) {
                                                                if (width > maxWidth) {
                                                                    height = Math.round((height * maxWidth) / width);
                                                                    width = maxWidth;
                                                                }
                                                            } else {
                                                                if (height > maxHeight) {
                                                                    width = Math.round((width * maxHeight) / height);
                                                                    height = maxHeight;
                                                                }
                                                            }
                                                            const canvas = document.createElement('canvas');
                                                            canvas.width = width;
                                                            canvas.height = height;
                                                            const ctx = canvas.getContext('2d');
                                                            ctx?.drawImage(img, 0, 0, width, height);
                                                            resolve(canvas.toDataURL('image/jpeg', quality));
                                                        };
                                                        img.onerror = (e) => reject(e);
                                                    };
                                                    reader.onerror = (e) => reject(e);
                                                });
                                            };

                                            message.loading({ content: 'Processing image...', key: 'img-proc' });
                                            const compressed = await compressImage(file);
                                            setImages(prev => [...prev, compressed]);
                                            message.success({ content: 'Image added', key: 'img-proc' });
                                        } catch (error) {
                                            message.error('Error processing image');
                                        }
                                        return false;
                                    }}
                                    accept="image/*"
                                >
                                    <div>
                                        <PlusOutlined />
                                        <div style={{ marginTop: 8 }}>Add</div>
                                    </div>
                                </Upload>
                            )}
                        </div>
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Category"
                                name="categoryId"
                                rules={[{ required: true, message: 'Category is required' }]}
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
                            <Form.Item label="Subcategory (Optional)" name="subcategoryId">
                                <Select
                                    placeholder="Select subcategory"
                                    allowClear
                                    disabled={!selectedCategory}
                                    showSearch
                                    filterOption={(input, option) =>
                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    options={subcategories.map(subcat => ({
                                        value: subcat.id,
                                        label: subcat.name,
                                    }))}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {productType === 'COMPOSED' && (
                        <Card
                            title={<span style={{ color: '#722ed1' }}><NodeIndexOutlined /> Composed Product Recipe</span>}
                            size="small"
                            style={{ marginBottom: 24, borderColor: '#d3adf7', background: '#f9f0ff' }}
                        >
                            <Alert
                                message="Cost and stock will be automatically calculated based on the added components."
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />

                            <Form.List name="components">
                                {(fields, { add, remove }) => (
                                    <>
                                        {fields.map(({ key, name, ...restField }) => (
                                            <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                                                <Col span={14}>
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, 'componentProductId']}
                                                        rules={[{ required: true, message: 'Required' }]}
                                                        style={{ marginBottom: 0 }}
                                                    >
                                                        <Select
                                                            showSearch
                                                            placeholder="Search item..."
                                                            onSearch={handleIngredientSearch}
                                                            filterOption={false}
                                                            onSelect={(val, _option: any) => {
                                                                const component = availableIngredients.find(p => p.id === val);
                                                                if (component) {
                                                                    const currentComps = form.getFieldValue('components');
                                                                    currentComps[name].cost = component.costPrice;
                                                                    currentComps[name].stock = component.stock;
                                                                    currentComps[name].rate = component.currency?.isPrimary ? 1 : Number(component.currency?.exchangeRate || 1);
                                                                    form.setFieldValue('components', currentComps);
                                                                    updateComposedFields();
                                                                }
                                                            }}
                                                            options={availableIngredients.map(p => ({
                                                                value: p.id,
                                                                label: `${p.sku} - ${p.name} (Stock: ${p.stock})`,
                                                            }))}
                                                        />
                                                    </Form.Item>
                                                </Col>
                                                <Col span={6}>
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, 'quantity']}
                                                        rules={[{ required: true, message: 'Qty' }]}
                                                        style={{ marginBottom: 0 }}
                                                    >
                                                        <InputNumber
                                                            placeholder="Qty"
                                                            style={{ width: '100%' }}
                                                            min={0.001}
                                                            onChange={updateComposedFields}
                                                        />
                                                    </Form.Item>
                                                </Col>
                                                <Col span={4}>
                                                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => {
                                                        remove(name);
                                                        updateComposedFields();
                                                    }} />
                                                </Col>
                                            </Row>
                                        ))}
                                        <Button
                                            type="dashed"
                                            onClick={() => add()}
                                            block
                                            icon={<PlusOutlined />}
                                            style={{ marginTop: 8 }}
                                        >
                                            Add item
                                        </Button>
                                    </>
                                )}
                            </Form.List>
                        </Card>
                    )}

                    <Divider orientation={"left" as any} style={{ margin: '12px 0' }}>
                        <span style={{ fontSize: '14px', color: '#666' }}>Pricing and Inventory</span>
                    </Divider>

                    <Card size="small" style={{ marginBottom: 16, background: '#f9f9f9', border: '1px dashed #d9d9d9' }}>
                        <Form.Item
                            label={<span style={{ fontWeight: 500 }}>Import prices from similar product</span>}
                            tooltip="Search an existing product to copy its price and currency configuration"
                            style={{ marginBottom: 0 }}
                        >
                            <Select
                                showSearch
                                value={similarProductSearch || undefined}
                                placeholder="Type SKU or product name..."
                                defaultActiveFirstOption={false}
                                suffixIcon={null}
                                filterOption={false}
                                onSearch={handleSearchSimilar}
                                onChange={handleImportFromProduct}
                                notFoundContent={isSearchingSimilar ? 'Searching...' : null}
                                options={similarProducts.map(p => ({
                                    value: p.id,
                                    label: `${p.sku} - ${p.name} (${p.currency?.symbol}${p.salePrice})`,
                                }))}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>
                    </Card>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Currency"
                                name="currencyId"
                                rules={[{ required: true, message: 'Currency is required' }]}
                            >
                                <Select
                                    placeholder="Select currency"
                                    showSearch
                                    filterOption={(input, option) =>
                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    options={currencies.map(curr => ({
                                        value: curr.id,
                                        label: `${curr.name} (${curr.symbol})`,
                                    }))}
                                />
                            </Form.Item>

                            <Form.Item
                                label="Cost Price"
                                name="costPrice"
                                rules={[
                                    { required: true, message: 'Cost price is required' },
                                    { type: 'number', min: 0, message: 'Must be greater than or equal to 0' },
                                ]}
                            >
                                <InputNumber
                                    placeholder={productType === 'COMPOSED' ? "Auto-calculated" : "0.00"}
                                    style={{ width: '100%' }}
                                    precision={2}
                                    min={0}
                                    disabled={productType === 'COMPOSED'}
                                />
                            </Form.Item>

                            <Form.Item
                                label={productType === 'COMPOSED' ? "Availability (Auto)" : "Initial Stock"}
                                name="stock"
                                rules={[{ type: 'number', min: 0, message: 'Must be greater than or equal to 0' }]}
                            >
                                <InputNumber
                                    placeholder={productType === 'COMPOSED' ? "Auto-calculated" : "0.000"}
                                    style={{ width: '100%' }}
                                    precision={3}
                                    min={0}
                                    disabled={productType === 'COMPOSED'}
                                />
                            </Form.Item>

                            <Row gutter={8}>
                                <Col span={12}>
                                    <Form.Item
                                        label="Primary Unit"
                                        name="unitId"
                                        rules={[{ required: true, message: 'Unit is required' }]}
                                    >
                                        <Select
                                            placeholder="Select unit"
                                            showSearch
                                            filterOption={(input, option) =>
                                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                            }
                                            options={units.map(unit => ({
                                                value: unit.id,
                                                label: `${unit.name} (${unit.abbreviation})`,
                                            }))}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="Secondary Unit (Optional)" name="secondaryUnitId">
                                        <Select
                                            placeholder="e.g., Box, Pack"
                                            allowClear
                                            showSearch
                                            onChange={handleSecondaryUnitChange}
                                            filterOption={(input, option) =>
                                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                            }
                                            options={units.map(unit => ({
                                                value: unit.id,
                                                label: `${unit.name} (${unit.abbreviation})`,
                                            }))}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Col>

                        <Col span={12}>
                            <Form.Item label="Sales Price (Normal)" style={{ marginBottom: 8 }}>
                                <Row gutter={8}>
                                    <Col span={12}>
                                        <Form.Item
                                            name="salePrice"
                                            noStyle
                                            rules={[
                                                { required: true, message: 'Required' },
                                                { type: 'number', min: 0, message: 'Must be >= 0' },
                                                ({ getFieldValue }) => ({
                                                    validator(_, value) {
                                                        const costPrice = getFieldValue('costPrice');
                                                        if (!value || value >= costPrice) {
                                                            return Promise.resolve();
                                                        }
                                                        return Promise.reject(new Error('Must be >= cost'));
                                                    },
                                                }),
                                            ]}
                                        >
                                            <InputNumber
                                                placeholder="Price"
                                                style={{ width: '100%' }}
                                                precision={2}
                                                min={0}
                                                onChange={handleSalePriceChange}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="saleProfitPercent" noStyle>
                                            <InputNumber
                                                placeholder="Profit %"
                                                style={{ width: '100%' }}
                                                precision={2}
                                                min={-100}
                                                max={10000}
                                                onChange={handleSaleProfitPercentChange}
                                                addonAfter="%"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Form.Item>

                            <Form.Item label="Offer Price (Optional)" style={{ marginBottom: 8 }}>
                                <Row gutter={8}>
                                    <Col span={12}>
                                        <Form.Item
                                            name="offerPrice"
                                            noStyle
                                            rules={[
                                                { type: 'number', min: 0, message: 'Must be >= 0' },
                                                ({ getFieldValue }) => ({
                                                    validator(_, value) {
                                                        if (!value) return Promise.resolve();
                                                        const costPrice = getFieldValue('costPrice');
                                                        if (value >= costPrice) {
                                                            return Promise.resolve();
                                                        }
                                                        return Promise.reject(new Error('Must be >= cost'));
                                                    },
                                                }),
                                            ]}
                                        >
                                            <InputNumber
                                                placeholder="Price"
                                                style={{ width: '100%' }}
                                                precision={2}
                                                min={0}
                                                onChange={handleOfferPriceChange}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="offerProfitPercent" noStyle>
                                            <InputNumber
                                                placeholder="Profit %"
                                                style={{ width: '100%' }}
                                                precision={2}
                                                min={-100}
                                                max={10000}
                                                onChange={handleOfferProfitPercentChange}
                                                addonAfter="%"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Form.Item>

                            <Form.Item label="Wholesale Price (Optional)" style={{ marginBottom: 8 }}>
                                <Row gutter={8}>
                                    <Col span={12}>
                                        <Form.Item
                                            name="wholesalePrice"
                                            noStyle
                                            rules={[
                                                { type: 'number', min: 0, message: 'Must be >= 0' },
                                                ({ getFieldValue }) => ({
                                                    validator(_, value) {
                                                        if (!value) return Promise.resolve();
                                                        const costPrice = getFieldValue('costPrice');
                                                        if (value >= costPrice) {
                                                            return Promise.resolve();
                                                        }
                                                        return Promise.reject(new Error('Must be >= cost'));
                                                    },
                                                }),
                                            ]}
                                        >
                                            <InputNumber
                                                placeholder="Price"
                                                style={{ width: '100%' }}
                                                precision={2}
                                                min={0}
                                                onChange={handleWholesalePriceChange}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="wholesaleProfitPercent" noStyle>
                                            <InputNumber
                                                placeholder="Profit %"
                                                style={{ width: '100%' }}
                                                precision={2}
                                                min={-100}
                                                max={10000}
                                                onChange={handleWholesaleProfitPercentChange}
                                                addonAfter="%"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Form.Item>
                        </Col>
                    </Row>

                    {hasSecondaryUnit && (
                        <>
                            <Divider>Secondary Unit</Divider>
                            <Alert
                                message="Conversion Configuration"
                                description={
                                    conversionDirection === 'primary_to_secondary'
                                        ? `The Secondary Unit (e.g., Box) contains multiple Primary Units.`
                                        : `The Primary Unit (e.g., Roll) contains multiple Secondary Units.`
                                }
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item
                                        label="Conversion Type"
                                        name="conversionDirection"
                                        initialValue="primary_to_secondary"
                                    >
                                        <Select
                                            onChange={(value) => {
                                                setConversionDirection(value);
                                                calculateSecondaryPrices();
                                            }}
                                            options={[
                                                { value: 'primary_to_secondary', label: 'Primary → Secondary (Multiply)' },
                                                { value: 'secondary_to_primary', label: 'Secondary → Primary (Divide)' },
                                            ]}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        label="Conversion Quantity"
                                        name="unitsPerSecondaryUnit"
                                        help={
                                            conversionDirection === 'primary_to_secondary'
                                                ? 'e.g., 1 Box = 12 Units'
                                                : 'e.g., 1 Roll = 50 Meters'
                                        }
                                        rules={[{ required: hasSecondaryUnit, message: 'Required' }]}
                                    >
                                        <InputNumber
                                            placeholder="Quantity"
                                            style={{ width: '100%' }}
                                            precision={0}
                                            min={1}
                                            onChange={handleUnitsPerSecondaryChange}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Card title="Pricing for Secondary Unit" size="small">
                                <Form.Item
                                    label="Secondary Cost Price"
                                    name="secondaryCostPrice"
                                    rules={[{ type: 'number', min: 0, message: 'Must be >= 0' }]}
                                >
                                    <InputNumber
                                        placeholder="Auto-calculated"
                                        style={{ width: '100%' }}
                                        precision={2}
                                        min={0}
                                        onChange={handleUnitsPerSecondaryChange}
                                    />
                                </Form.Item>

                                <Form.Item label="Secondary Sale Price" style={{ marginBottom: 8 }}>
                                    <Row gutter={8}>
                                        <Col span={12}>
                                            <Form.Item
                                                name="secondarySalePrice"
                                                noStyle
                                                rules={[
                                                    { type: 'number', min: 0, message: 'Must be >= 0' },
                                                    ({ getFieldValue }) => ({
                                                        validator(_, value) {
                                                            if (!value) return Promise.resolve();
                                                            const secondaryCost = getFieldValue('secondaryCostPrice');
                                                            if (!secondaryCost || value >= secondaryCost) {
                                                                return Promise.resolve();
                                                            }
                                                            return Promise.reject(new Error('Must be >= packaging cost'));
                                                        },
                                                    }),
                                                ]}
                                            >
                                                <InputNumber
                                                    placeholder="Auto-calculated"
                                                    style={{ width: '100%' }}
                                                    precision={2}
                                                    min={0}
                                                    onChange={handleSecondarySalePriceChange}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="secondarySaleProfitPercent" noStyle>
                                                <InputNumber
                                                    placeholder="Profit %"
                                                    style={{ width: '100%' }}
                                                    precision={2}
                                                    min={-100}
                                                    max={10000}
                                                    addonAfter="%"
                                                    onChange={handleSecondarySaleProfitPercentChange}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Form.Item>

                                <Form.Item label="Secondary Offer Price" style={{ marginBottom: 8 }}>
                                    <Row gutter={8}>
                                        <Col span={12}>
                                            <Form.Item
                                                name="secondaryOfferPrice"
                                                noStyle
                                                rules={[
                                                    { type: 'number', min: 0, message: 'Must be >= 0' },
                                                    ({ getFieldValue }) => ({
                                                        validator(_, value) {
                                                            if (!value) return Promise.resolve();
                                                            const secondaryCost = getFieldValue('secondaryCostPrice');
                                                            if (!secondaryCost || value >= secondaryCost) {
                                                                return Promise.resolve();
                                                            }
                                                            return Promise.reject(new Error('Must be >= packaging cost'));
                                                        },
                                                    }),
                                                ]}
                                            >
                                                <InputNumber
                                                    placeholder="Auto-calculated"
                                                    style={{ width: '100%' }}
                                                    precision={2}
                                                    min={0}
                                                    onChange={handleSecondaryOfferPriceChange}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="secondaryOfferProfitPercent" noStyle>
                                                <InputNumber
                                                    placeholder="Profit %"
                                                    style={{ width: '100%' }}
                                                    precision={2}
                                                    min={-100}
                                                    max={10000}
                                                    addonAfter="%"
                                                    onChange={handleSecondaryOfferProfitPercentChange}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Form.Item>

                                <Form.Item label="Secondary Wholesale Price" style={{ marginBottom: 8 }}>
                                    <Row gutter={8}>
                                        <Col span={12}>
                                            <Form.Item
                                                name="secondaryWholesalePrice"
                                                noStyle
                                                rules={[
                                                    { type: 'number', min: 0, message: 'Must be >= 0' },
                                                    ({ getFieldValue }) => ({
                                                        validator(_, value) {
                                                            if (!value) return Promise.resolve();
                                                            const secondaryCost = getFieldValue('secondaryCostPrice');
                                                            if (!secondaryCost || value >= secondaryCost) {
                                                                return Promise.resolve();
                                                            }
                                                            return Promise.reject(new Error('Must be >= packaging cost'));
                                                        },
                                                    }),
                                                ]}
                                            >
                                                <InputNumber
                                                    placeholder="Auto-calculated"
                                                    style={{ width: '100%' }}
                                                    precision={2}
                                                    min={0}
                                                    onChange={handleSecondaryWholesalePriceChange}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="secondaryWholesaleProfitPercent" noStyle>
                                                <InputNumber
                                                    placeholder="Profit %"
                                                    style={{ width: '100%' }}
                                                    precision={2}
                                                    min={-100}
                                                    max={10000}
                                                    addonAfter="%"
                                                    onChange={handleSecondaryWholesaleProfitPercentChange}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Form.Item>
                            </Card>
                        </>
                    )}
                </Form>
            </Modal>

            <PriceUpdateConfirmModal
                visible={priceUpdateModalVisible}
                loading={priceUpdateLoading}
                products={costChangeInfo ? [costChangeInfo] : []}
                currencySymbol={selectedCurrency?.symbol || product?.currency?.symbol || '$'}
                onConfirm={handlePriceUpdateConfirm}
                onCancel={handlePriceUpdateCancel}
            />
        </>
    );
};
