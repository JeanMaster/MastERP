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
import 'dayjs/locale/es';

dayjs.extend(relativeTime);
dayjs.locale('es');

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export const SocialAssistant = () => {
    const queryClient = useQueryClient();
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [platform, setPlatform] = useState<string>('Instagram');
    const [instructions, setInstructions] = useState<string>('');
    const [generatedContent, setGeneratedContent] = useState<string>('');
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Queries
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

    // Mutations
    const generateMutation = useMutation({
        mutationFn: marketingApi.generateSocialPost,
        onSuccess: (data) => {
            setGeneratedContent(data.content);
            message.success('¡Post generado con éxito!');
            queryClient.invalidateQueries({ queryKey: ['social-drafts'] });
        },
        onError: () => message.error('Error al generar el post con IA')
    });

    const deleteDraftMutation = useMutation({
        mutationFn: marketingApi.deleteSocialDraft,
        onSuccess: () => {
            message.success('Borrador eliminado');
            queryClient.invalidateQueries({ queryKey: ['social-drafts'] });
        }
    });

    const handleGenerate = () => {
        if (!selectedProductId) {
            message.warning('Primero selecciona un producto');
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
        message.success('Copiado al portapapeles');
    };

    const shareOnWhatsApp = (text: string) => {
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const shareOnFacebook = (text: string) => {
        // Facebook sharer works better with URLs, but we can try to copy first
        copyToClipboard(text);
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.origin), '_blank');
        message.info('Texto copiado. Puedes pegarlo en tu publicación de Facebook.');
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2}><ShareAltOutlined /> Social Hub <Tag color="purple">IA Assistant</Tag></Title>
                <Text type="secondary">Crea contenido persuasivo para tus redes sociales en segundos.</Text>
            </div>

            <Row gutter={24}>
                {/* Left Column: Input and Generation */}
                <Col span={14}>
                    <Card 
                        title="1. Selecciona el Producto" 
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
                                    <div style={{ marginTop: 4 }}>
                                        <Tag color="green">${selectedProduct.salePrice.toFixed(2)}</Tag>
                                        <Tag color="blue">Stock: {selectedProduct.stock}</Tag>
                                        <Button size="small" type="link" onClick={() => setSelectedProductId(null)}>Cambiar producto</Button>
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
                                Buscar producto en inventario...
                            </Button>
                        )}
                    </Card>

                    <Card 
                        title="2. Configura tu Post" 
                        bordered={false}
                        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    >
                        <Row gutter={16}>
                            <Col span={12}>
                                <Text strong>Plataforma Destino</Text>
                                <Select 
                                    style={{ width: '100%', marginTop: 8 }} 
                                    value={platform} 
                                    onChange={setPlatform}
                                >
                                    <Select.Option value="Instagram">Instagram (Con Hashtags)</Select.Option>
                                    <Select.Option value="WhatsApp">WhatsApp (Directo y Personal)</Select.Option>
                                    <Select.Option value="Facebook">Facebook (Informativo)</Select.Option>
                                    <Select.Option value="TikTok">TikTok (Idea de Video)</Select.Option>
                                </Select>
                            </Col>
                            <Col span={24} style={{ marginTop: 16 }}>
                                <Text strong>Instrucciones Extra (Opcional)</Text>
                                <TextArea 
                                    rows={3} 
                                    placeholder="Ej: Solo menciona que el precio es de locura, usa un tono divertido, resalta que hay pocas unidades..."
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
                                border: 'none'
                            }}
                        >
                            Generar Post con IA
                        </Button>
                    </Card>

                    {generatedContent && (
                        <Card 
                            title="Resultado de la IA" 
                            extra={<Tag color="purple">Listo para editar</Tag>}
                            style={{ marginTop: 24, boxShadow: '0 4px 20px rgba(114, 46, 209, 0.1)' }}
                        >
                            <TextArea 
                                rows={10} 
                                value={generatedContent} 
                                onChange={e => setGeneratedContent(e.target.value)}
                                style={{ fontFamily: 'monospace', fontSize: '14px', borderRadius: 8 }}
                            />
                            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
                                <Tooltip title="Copiar texto">
                                    <Button shape="circle" size="large" icon={<CopyOutlined />} onClick={() => copyToClipboard(generatedContent)} />
                                </Tooltip>
                                <Tooltip title="Enviar a WhatsApp">
                                    <Button shape="circle" size="large" icon={<WhatsAppOutlined />} color="green" onClick={() => shareOnWhatsApp(generatedContent)} />
                                </Tooltip>
                                <Tooltip title="Publicar en Facebook">
                                    <Button shape="circle" size="large" icon={<FacebookOutlined />} onClick={() => shareOnFacebook(generatedContent)} />
                                </Tooltip>
                                <Tooltip title="Copiar para Instagram">
                                    <Button shape="circle" size="large" icon={<InstagramOutlined />} onClick={() => copyToClipboard(generatedContent)} />
                                </Tooltip>
                            </div>
                        </Card>
                    )}
                </Col>

                {/* Right Column: Recent Drafts */}
                <Col span={10}>
                    <Card title="Borradores Recientes" bordered={false} style={{ height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        {isDraftsLoading ? <Spin /> : (
                            <List
                                dataSource={drafts}
                                locale={{ emptyText: <Empty description="Aún no hay borradores" /> }}
                                renderItem={(item: any) => (
                                    <List.Item
                                        actions={[
                                            <Button type="link" icon={<CopyOutlined />} onClick={() => setGeneratedContent(item.content)}>Cargar</Button>,
                                            <Popconfirm title="¿Eliminar?" onConfirm={() => deleteDraftMutation.mutate(item.id)}>
                                                <Button type="link" danger icon={<DeleteOutlined />} />
                                            </Popconfirm>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            avatar={<Avatar icon={item.platform === 'WhatsApp' ? <WhatsAppOutlined /> : <InstagramOutlined />} />}
                                            title={<Text strong>{item.platform} - {dayjs(item.createdAt).fromNow()}</Text>}
                                            description={<Paragraph ellipsis={{ rows: 2 }}>{item.content}</Paragraph>}
                                        />
                                    </List.Item>
                                )}
                            />
                        )}
                    </Card>
                </Col>
            </Row>

            {/* Product Search Modal */}
            <Modal
                title="Buscar Producto"
                open={isProductSearchOpen}
                onCancel={() => setIsProductSearchOpen(false)}
                footer={null}
                width={700}
            >
                <Input 
                    placeholder="Escribe el nombre o SKU el producto..." 
                    prefix={<SearchOutlined />} 
                    onChange={e => setSearchTerm(e.target.value)}
                    size="large"
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
                                description={`SKU: ${product.sku} | Precio: $${product.salePrice} | Stock: ${product.stock}`}
                            />
                            <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        </List.Item>
                    )}
                />
            </Modal>
        </div>
    );
};
