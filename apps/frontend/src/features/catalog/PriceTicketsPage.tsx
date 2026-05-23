import { useState, useEffect } from 'react';
import {
    Card, Form, Select, Button, Space, Typography, message, Spin,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { catalogoApi, type CatalogProduct, type CatalogCurrency } from '../../services/catalogoApi';
import { api } from '../../services/apiConfig';


const { Title, Text } = Typography;

export const PriceTicketsPage = () => {
    const { t } = useTranslation();

    const [currencies, setCurrencies] = useState<CatalogCurrency[]>([]);
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(false);

    // Tickets state
    const [ticketProductId, setTicketProductId] = useState<string | null>(null);
    const [manualTicketList, setManualTicketList] = useState<Array<{ productId: string; quantity: number; name: string }>>([]);
    const [ticketsLoading, setTicketsLoading] = useState(false);

    // Load currencies
    useEffect(() => {
        api.get('/currencies')
            .then((r) => {
                setCurrencies(r.data);
                const primary = r.data.find((c: CatalogCurrency) => c.isPrimary);
                if (primary) setSelectedCurrency(primary.code);
            })
            .catch(() => {});
    }, []);

    // Load products when currency changes
    useEffect(() => {
        setLoading(true);
        catalogoApi.getCatalogData(selectedCurrency)
            .then(setProducts)
            .finally(() => setLoading(false));
    }, [selectedCurrency]);

    const handleFillPageWithProduct = async () => {
        if (!ticketProductId) return;
        setTicketsLoading(true);
        try {
            const blob = await catalogoApi.generatePriceTickets(selectedCurrency, [
                { productId: ticketProductId, quantity: 10 },
            ]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tickets-${selectedCurrency}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            message.success('Hoja de tickets generada');
        } catch {
            message.error('Error al generar tickets');
        } finally {
            setTicketsLoading(false);
        }
    };

    const addToManualTickets = () => {
        if (!ticketProductId) return;
        const prod = products.find(p => p.id === ticketProductId);
        if (!prod) return;

        setManualTicketList(prev => {
            const existing = prev.findIndex(t => t.productId === ticketProductId);
            if (existing >= 0) {
                const copy = [...prev];
                copy[existing] = { ...copy[existing], quantity: copy[existing].quantity + 1 };
                return copy;
            }
            return [...prev, { productId: ticketProductId, quantity: 1, name: prod.name }];
        });
        message.success(`Agregado: ${prod.name}`);
    };

    const removeManualTicket = (productId: string) => {
        setManualTicketList(prev => prev.filter(t => t.productId !== productId));
    };

    const handleGenerateManualTickets = async () => {
        if (manualTicketList.length === 0) {
            message.warning('Agrega al menos un producto');
            return;
        }
        setTicketsLoading(true);
        try {
            const payload = manualTicketList.map(t => ({ productId: t.productId, quantity: t.quantity }));
            const blob = await catalogoApi.generatePriceTickets(selectedCurrency, payload);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tickets-${selectedCurrency}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            message.success('Tickets generados');
            setManualTicketList([]);
        } catch {
            message.error('Error al generar tickets');
        } finally {
            setTicketsLoading(false);
        }
    };

    return (
        <div style={{ padding: 24 }}>
            <Card
                bordered={false}
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
            >
                <div style={{ marginBottom: 20 }}>
                    <Title level={2} style={{ margin: 0 }}>
                        🎫 Tickets de Precios
                    </Title>
                    <Text type="secondary">
                        Genera hojas con etiquetas de precio para imprimir. <strong>10 tickets por página</strong> (2 columnas × 5 filas).
                    </Text>
                </div>

                {/* Currency selector */}
                <Form layout="inline" style={{ marginBottom: 24 }}>
                    <Form.Item label={t('catalog.currency_label')}>
                        <Select
                            value={selectedCurrency}
                            onChange={setSelectedCurrency}
                            style={{ minWidth: 200 }}
                            options={currencies.map(c => ({
                                value: c.code,
                                label: `${c.name} (${c.symbol})${c.isPrimary ? ' — Principal' : ''}`
                            }))}
                        />
                    </Form.Item>
                </Form>

                <Spin spinning={loading}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <div>
                            <Text strong>Producto:</Text>
                            <Select
                                showSearch
                                placeholder="Buscar y seleccionar producto..."
                                style={{ width: '100%', marginTop: 8 }}
                                value={ticketProductId}
                                onChange={setTicketProductId}
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                                }
                                options={products.map(p => ({
                                    value: p.id,
                                    label: `${p.name} ${p.sku ? `(${p.sku})` : ''}`,
                                }))}
                            />
                        </div>

                        <Space wrap>
                            <Button
                                type="primary"
                                onClick={handleFillPageWithProduct}
                                disabled={!ticketProductId}
                                loading={ticketsLoading}
                            >
                                Llenar hoja completa (10 tickets del mismo producto)
                            </Button>

                            <Button
                                onClick={addToManualTickets}
                                disabled={!ticketProductId}
                            >
                                + Agregar 1 ticket de este producto
                            </Button>
                        </Space>

                        {manualTicketList.length > 0 && (
                            <div>
                                <Text strong>Tickets en la lista ({manualTicketList.reduce((s, t) => s + t.quantity, 0)} total):</Text>
                                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {manualTicketList.map((t, idx) => (
                                        <div key={idx} style={{
                                            background: '#f0f0f0',
                                            padding: '4px 10px',
                                            borderRadius: 6,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                        }}>
                                            <span>{t.name} × {t.quantity}</span>
                                            <Button size="small" danger onClick={() => removeManualTicket(t.productId)}>
                                                ×
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                <Button
                                    type="primary"
                                    style={{ marginTop: 12 }}
                                    onClick={handleGenerateManualTickets}
                                    loading={ticketsLoading}
                                >
                                    Generar PDF con los tickets seleccionados
                                </Button>
                            </div>
                        )}
                    </Space>
                </Spin>
            </Card>
        </div>
    );
};

export default PriceTicketsPage;
