import { useState } from 'react';
import { Card, Row, Col, Typography, Input, Select, Button, Space, message, List, Avatar, Spin, Divider, Modal, Tooltip, Tag, Popconfirm, Empty } from 'antd';
import { 
    RobotOutlined, 
    InstagramOutlined, 
    WhatsAppOutlined, 
    FacebookOutlined, 
    CopyOutlined,
    SearchOutlined,
    DeleteOutlined,
    VideoCameraOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { productsApi } from '../../services/productsApi';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * SocialAssistant Component
 * AI-powered social media copywriter.
 * Leverages product data and AI to generate optimized posts for Instagram, Facebook, WhatsApp, and TikTok.
 * Features: Product search, platform-specific templates, AI generation, and draft management.
 */
export const SocialAssistant = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [platform, setPlatform] = useState('instagram');
    const [extraInstructions, setExtraInstructions] = useState('');
    const [generatedContent, setGeneratedContent] = useState<string | null>(null);
    const [isProductModalVisible, setIsProductModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { data: products, isLoading: loadingProducts } = useQuery({
        queryKey: ['social-product-search', searchQuery],
        queryFn: () => productsApi.getAll({ search: searchQuery, limit: 10, active: true }),
        enabled: isProductModalVisible && searchQuery.length > 2
    });

    const { data: drafts, isLoading: loadingDrafts } = useQuery({
        queryKey: ['social-drafts'],
        queryFn: marketingApi.getSocialDrafts,
    });

    /**
     * Calls the AI service to generate a persuasive post based on product details and instructions.
     */
    const generateMutation = useMutation({
        mutationFn: marketingApi.generateSocialPost,
        onSuccess: (data) => {
            setGeneratedContent(data.content);
            message.success(t('marketing.social.success_generate'));
            queryClient.invalidateQueries({ queryKey: ['social-drafts'] });
        },
        onError: () => {
            message.error(t('marketing.social.error_generate'));
        }
    });

    const deleteDraftMutation = useMutation({
        mutationFn: marketingApi.deleteSocialDraft,
        onSuccess: () => {
            message.success(t('marketing.social.draft_deleted'));
            queryClient.invalidateQueries({ queryKey: ['social-drafts'] });
        }
    });

    const handleGenerate = () => {
        if (!selectedProduct) {
            return message.warning(t('marketing.social.select_product_first'));
        }
        generateMutation.mutate({
            productId: selectedProduct.id,
            platform,
            instructions: extraInstructions
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        message.success(t('marketing.social.copied'));
    };

    const shareOnWhatsApp = (text: string) => {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const shareOnFacebook = (text: string) => {
        copyToClipboard(text);
        window.open('https://www.facebook.com', '_blank');
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
                <Title level={2}><RobotOutlined /> {t('marketing.social.social_hub')}</Title>
                <Text type="secondary">{t('marketing.social.social_subtitle')}</Text>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} lg={14}>
                    <Card bordered={false} title={<span><RobotOutlined style={{ color: '#1890ff' }} /> {t('marketing.social.ai_powered')}</span>}>
                        <div style={{ marginBottom: 24 }}>
                            <Title level={5}>{t('marketing.social.select_product')}</Title>
                            {selectedProduct ? (
                                <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Space>
                                            <Avatar src={selectedProduct.images?.[0]} shape="square" size="large" />
                                            <div>
                                                <Text strong>{selectedProduct.name}</Text><br/>
                                                <Text type="secondary">SKU: {selectedProduct.sku}</Text>
                                            </div>
                                        </Space>
                                        <Button size="small" onClick={() => setIsProductModalVisible(true)}>{t('marketing.social.change_product')}</Button>
                                    </div>
                                </Card>
                            ) : (
                                <Button 
                                    block 
                                    size="large" 
                                    icon={<SearchOutlined />} 
                                    onClick={() => setIsProductModalVisible(true)}
                                >
                                    {t('marketing.social.search_inventory')}
                                </Button>
                            )}
                        </div>

                        <Divider />

                        <div style={{ marginBottom: 24 }}>
                            <Title level={5}>{t('marketing.social.configure_post')}</Title>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Text strong>{t('marketing.social.target_platform')}</Text>
                                    <Select 
                                        style={{ width: '100%', marginTop: 8 }} 
                                        value={platform}
                                        onChange={setPlatform}
                                    >
                                        <Select.Option value="instagram"><InstagramOutlined /> {t('marketing.social.platforms.instagram')}</Select.Option>
                                        <Select.Option value="whatsapp"><WhatsAppOutlined /> {t('marketing.social.platforms.whatsapp')}</Select.Option>
                                        <Select.Option value="facebook"><FacebookOutlined /> {t('marketing.social.platforms.facebook')}</Select.Option>
                                        <Select.Option value="tiktok"><VideoCameraOutlined /> {t('marketing.social.platforms.tiktok')}</Select.Option>
                                    </Select>
                                </Col>
                                <Col span={24} style={{ marginTop: 16 }}>
                                    <Text strong>{t('marketing.social.extra_instructions')}</Text>
                                    <TextArea 
                                        rows={3} 
                                        style={{ marginTop: 8 }}
                                        placeholder={t('marketing.social.instructions_placeholder')}
                                        value={extraInstructions}
                                        onChange={e => setExtraInstructions(e.target.value)}
                                    />
                                </Col>
                            </Row>
                        </div>

                        <Button 
                            type="primary" 
                            size="large" 
                            block 
                            icon={<RobotOutlined />}
                            onClick={handleGenerate}
                            loading={generateMutation.isPending}
                        >
                            {t('marketing.social.generate_button')}
                        </Button>
                    </Card>

                    {generatedContent && (
                        <Card 
                            title={t('marketing.social.generated_content')} 
                            extra={<Tag color="purple">{t('marketing.social.ready_to_publish')}</Tag>}
                            style={{ marginTop: 24, boxShadow: '0 4px 20px rgba(114, 46, 209, 0.1)' }}
                        >
                            <TextArea 
                                rows={10} 
                                value={generatedContent} 
                                onChange={e => setGeneratedContent(e.target.value)}
                                style={{ fontFamily: 'monospace', fontSize: '14px', borderRadius: 8 }}
                            />
                            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 16 }}>
                                <Tooltip title={t('marketing.social.copy_text')}>
                                    <Button shape="circle" size="large" icon={<CopyOutlined />} onClick={() => copyToClipboard(generatedContent)} />
                                </Tooltip>
                                <Tooltip title={t('marketing.social.send_whatsapp')}>
                                    <Button shape="circle" size="large" icon={<WhatsAppOutlined />} style={{ color: '#25D366' }} onClick={() => shareOnWhatsApp(generatedContent)} />
                                </Tooltip>
                                <Tooltip title={t('marketing.social.post_facebook')}>
                                    <Button shape="circle" size="large" icon={<FacebookOutlined />} style={{ color: '#1877F2' }} onClick={() => shareOnFacebook(generatedContent)} />
                                </Tooltip>
                                <Tooltip title={t('marketing.social.copy_instagram')}>
                                    <Button shape="circle" size="large" icon={<InstagramOutlined />} style={{ color: '#E4405F' }} onClick={() => copyToClipboard(generatedContent)} />
                                </Tooltip>
                            </div>
                        </Card>
                    )}
                </Col>

                <Col xs={24} lg={10}>
                    <Card title={t('marketing.social.recent_drafts')} bordered={false} style={{ height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        {loadingDrafts ? <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div> : (
                            <List
                                dataSource={drafts}
                                locale={{ emptyText: <Empty description={t('marketing.social.no_drafts')} /> }}
                                renderItem={(item: any) => (
                                    <List.Item
                                        actions={[
                                            <Button type="link" icon={<CopyOutlined />} onClick={() => setGeneratedContent(item.content)}>{t('common.load', { defaultValue: 'Load' })}</Button>,
                                            <Popconfirm 
                                                title={t('common.are_you_sure')} 
                                                onConfirm={() => deleteDraftMutation.mutate(item.id)}
                                                okText={t('common.yes')}
                                                cancelText={t('common.no')}
                                            >
                                                <Button type="link" danger icon={<DeleteOutlined />} />
                                            </Popconfirm>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            avatar={<Avatar src={item.product?.images?.[0]} icon={item.platform === 'whatsapp' ? <WhatsAppOutlined /> : <InstagramOutlined />} />}
                                            title={<Text strong>{item.platform.toUpperCase()} • {dayjs(item.createdAt).fromNow()}</Text>}
                                            description={<Paragraph ellipsis={{ rows: 2 }}>{item.content}</Paragraph>}
                                        />
                                    </List.Item>
                                )}
                            />
                        )}
                    </Card>
                </Col>
            </Row>

            <Modal
                title={t('marketing.social.search_product_title')}
                open={isProductModalVisible}
                onCancel={() => setIsProductModalVisible(false)}
                footer={null}
                width={700}
            >
                <Input 
                    placeholder={t('marketing.social.type_sku')} 
                    prefix={<SearchOutlined />} 
                    onChange={e => setSearchQuery(e.target.value)}
                    size="large"
                    allowClear
                />
                <List
                    style={{ marginTop: 16 }}
                    dataSource={products}
                    loading={loadingProducts}
                    renderItem={(product: any) => (
                        <List.Item 
                            key={product.id} 
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                                setSelectedProduct(product);
                                setIsProductModalVisible(false);
                            }}
                            className="hover-item"
                        >
                            <List.Item.Meta
                                avatar={<Avatar src={product.images?.[0]} />}
                                title={product.name}
                                description={`SKU: ${product.sku} | Price: $${product.salePrice} | Stock: ${product.stock}`}
                            />
                            <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        </List.Item>
                    )}
                />
            </Modal>
        </div>
    );
};
