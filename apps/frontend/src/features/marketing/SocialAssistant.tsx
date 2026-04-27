import { useState } from 'react';
import { 
    Card, Select, Button, Input, Divider, 
    Row, Col, Typography, Tag, message, List, 
    Modal, Tooltip, Empty, Spin, Avatar, Popconfirm
} from 'antd';
import { 
    ShareAltOutlined, 
    BulbOutlined, 
    CopyOutlined, 
    WhatsAppOutlined, 
    FacebookOutlined, 
    InstagramOutlined,
    DeleteOutlined,
    SearchOutlined,
    PictureOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { productsApi } from '../../services/productsApi';
import type { Product } from '../../services/productsApi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * SocialAssistant Component
 * An AI-powered tool for generating marketing copy for social media platforms.
 * It integrates with the product catalog to create context-aware posts for Instagram, WhatsApp, Facebook, and TikTok.
 */
export const SocialAssistant = () => {
    const queryClient = useQueryClient();
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [platform, setPlatform] = useState<string>('Instagram');
    const [instructions, setInstructions] = useState<string>('');
    const [generatedContent, setGeneratedContent] = useState<string>('');
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const { data: products } = useQuery({
        queryKey: ['products-search', searchTerm],
        queryFn: () => productsApi.getAll({ search: searchTerm, limit: 10, active: true }),
        enabled: isProductSearchOpen && searchTerm.length > 2
    });

    const { data: selectedProduct } = useQuery({
        queryKey: ['product', selectedProductId],
        queryFn: () => productsApi.getOne(selectedProductId!),
        enabled: !!selectedProductId
    });

    const { data: drafts, isLoading: isDraftsLoading } = useQuery({
        queryKey: ['social-drafts'],
        queryFn: marketingApi.getSocialDrafts
    });

    /**
     * Triggers AI content generation based on product data and user instructions.
     */
    const generateMutation = useMutation({
        mutationFn: marketingApi.generateSocialPost,
        onSuccess: (data) => {
            setGeneratedContent(data.content);
            message.success('Post generated successfully!');
            queryClient.invalidateQueries({ queryKey: ['social-drafts'] });
        },
        onError: () => message.error('Failed to generate post with AI')
    });

    const deleteDraftMutation = useMutation({
        mutationFn: marketingApi.deleteSocialDraft,
        onSuccess: () => {
            message.success('Draft deleted');
            queryClient.invalidateQueries({ queryKey: ['social-drafts'] });
        }
    });

    const handleGenerate = () => {
        if (!selectedProductId) {
            message.warning('Please select a product first');
            return;
        }
        generateMutation.mutate({
            productId: selectedProductId,
            platform,
            instructions
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        message.success('Copied to clipboard');
    };

    const shareOnWhatsApp = (text: string) => {
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const shareOnFacebook = (text: string) => {
        copyToClipboard(text);
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.origin), '_blank');
        message.info('Text copied. You can now paste it into your Facebook post.');
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}><ShareAltOutlined /> Social Hub</Title>
                    <Text type="secondary">Create persuasive social media content in seconds using AI.</Text>
                </div>
                <Tag color="purple" style={{ fontSize: '14px', padding: '4px 12px' }}>AI Assistant Powered</Tag>
            </div>

            <Row gutter={24}>
                <Col xs={24} lg={14}>
                    <Card 
                        title="1. Select a Product" 
                        bordered={false} 
                        style={{ marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    >
                        {selectedProduct ? (
                            <div style={{ display: 'flex', gap: 16 }}>
                                <Avatar 
                                    shape="square" 
                                    size={80} 
                                    src={selectedProduct.images?.[0]} 
                                    icon={<PictureOutlined />} 
                                    style={{ borderRadius: 8 }}
                                />
                                <div style={{ flex: 1 }}>
                                    <Title level={4} style={{ margin: 0 }}>{selectedProduct.name}</Title>
                                    <Text type="secondary">{selectedProduct.category?.name} • SKU: {selectedProduct.sku}</Text>
                                    <div style={{ marginTop: 8 }}>
                                        <Tag color="green">${selectedProduct.salePrice.toFixed(2)}</Tag>
                                        <Tag color="blue">Stock: {selectedProduct.stock}</Tag>
                                        <Button size="small" type="link" onClick={() => setSelectedProductId(null)}>Change product</Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <Button 
                                block 
                                type="dashed" 
                                icon={<SearchOutlined />} 
                                size="large"
                                onClick={() => setIsProductSearchOpen(true)}
                                style={{ height: '80px', borderRadius: 8 }}
                            >
                                Search product in inventory...
                            </Button>
                        )}
                    </Card>

                    <Card 
                        title="2. Configure your Post" 
                        bordered={false}
                        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    >
                        <Row gutter={16}>
                            <Col span={24}>
                                <Text strong>Target Platform</Text>
                                <Select 
                                    style={{ width: '100%', marginTop: 8 }} 
                                    value={platform} 
                                    onChange={setPlatform}
                                    size="large"
                                >
                                    <Select.Option value="Instagram">Instagram (With Hashtags)</Select.Option>
                                    <Select.Option value="WhatsApp">WhatsApp (Direct & Personal)</Select.Option>
                                    <Select.Option value="Facebook">Facebook (Informative)</Select.Option>
                                    <Select.Option value="TikTok">TikTok (Video Idea/Script)</Select.Option>
                                </Select>
                            </Col>
                            <Col span={24} style={{ marginTop: 16 }}>
                                <Text strong>Extra Instructions (Optional)</Text>
                                <TextArea 
                                    rows={3} 
                                    placeholder="e.g., Use a funny tone, highlight limited stock, mention the crazy weekend deal..."
                                    style={{ marginTop: 8 }}
                                    value={instructions}
                                    onChange={e => setInstructions(e.target.value)}
                                />
                            </Col>
                        </Row>
                        
                        <Divider />
                        
                        <Button 
                            type="primary" 
                            size="large" 
                            block 
                            icon={<BulbOutlined />} 
                            loading={generateMutation.isPending}
                            disabled={!selectedProductId}
                            onClick={handleGenerate}
                            style={{ 
                                height: 50, 
                                borderRadius: 25, 
                                background: 'linear-gradient(90deg, #722ed1 0%, #eb2f96 100%)',
                                border: 'none',
                                fontWeight: 'bold'
                            }}
                        >
                            Generate Post with AI
                        </Button>
                    </Card>

                    {generatedContent && (
                        <Card 
                            title="AI Generated Content" 
                            extra={<Tag color="purple">Ready to publish</Tag>}
                            style={{ marginTop: 24, boxShadow: '0 4px 20px rgba(114, 46, 209, 0.1)' }}
                        >
                            <TextArea 
                                rows={10} 
                                value={generatedContent} 
                                onChange={e => setGeneratedContent(e.target.value)}
                                style={{ fontFamily: 'monospace', fontSize: '14px', borderRadius: 8 }}
                            />
                            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 16 }}>
                                <Tooltip title="Copy Text">
                                    <Button shape="circle" size="large" icon={<CopyOutlined />} onClick={() => copyToClipboard(generatedContent)} />
                                </Tooltip>
                                <Tooltip title="Send to WhatsApp">
                                    <Button shape="circle" size="large" icon={<WhatsAppOutlined />} style={{ color: '#25D366' }} onClick={() => shareOnWhatsApp(generatedContent)} />
                                </Tooltip>
                                <Tooltip title="Post to Facebook">
                                    <Button shape="circle" size="large" icon={<FacebookOutlined />} style={{ color: '#1877F2' }} onClick={() => shareOnFacebook(generatedContent)} />
                                </Tooltip>
                                <Tooltip title="Copy for Instagram">
                                    <Button shape="circle" size="large" icon={<InstagramOutlined />} style={{ color: '#E4405F' }} onClick={() => copyToClipboard(generatedContent)} />
                                </Tooltip>
                            </div>
                        </Card>
                    )}
                </Col>

                <Col xs={24} lg={10}>
                    <Card title="Recent Drafts" bordered={false} style={{ height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        {isDraftsLoading ? <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div> : (
                            <List
                                dataSource={drafts}
                                locale={{ emptyText: <Empty description="No drafts yet" /> }}
                                renderItem={(item: any) => (
                                    <List.Item
                                        actions={[
                                            <Button type="link" icon={<CopyOutlined />} onClick={() => setGeneratedContent(item.content)}>Load</Button>,
                                            <Popconfirm title="Delete draft?" onConfirm={() => deleteDraftMutation.mutate(item.id)}>
                                                <Button type="link" danger icon={<DeleteOutlined />} />
                                            </Popconfirm>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            avatar={<Avatar icon={item.platform === 'WhatsApp' ? <WhatsAppOutlined /> : <InstagramOutlined />} />}
                                            title={<Text strong>{item.platform} • {dayjs(item.createdAt).fromNow()}</Text>}
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
                title="Search Product"
                open={isProductSearchOpen}
                onCancel={() => setIsProductSearchOpen(false)}
                footer={null}
                width={700}
            >
                <Input 
                    placeholder="Type name or SKU..." 
                    prefix={<SearchOutlined />} 
                    onChange={e => setSearchTerm(e.target.value)}
                    size="large"
                    allowClear
                />
                <List
                    style={{ marginTop: 16 }}
                    dataSource={products}
                    loading={searchTerm.length > 2 && !products}
                    renderItem={(product: Product) => (
                        <List.Item 
                            key={product.id} 
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                                setSelectedProductId(product.id);
                                setIsProductSearchOpen(false);
                            }}
                            className="hover-item"
                        >
                            <List.Item.Meta
                                avatar={<Avatar src={product.images?.[0]} icon={<PictureOutlined />} />}
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
