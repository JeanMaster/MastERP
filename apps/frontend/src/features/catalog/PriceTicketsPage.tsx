import { useState, useEffect } from 'react';
import {
    Card, Form, Select, Button, Space, Typography, message, Spin, Switch,
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
    const [includeBarcode, setIncludeBarcode] = useState(true);

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
            const blob = await catalogoApi.generatePriceTickets(
                selectedCurrency,
                [{ productId: ticketProductId, quantity: 14 }],
                includeBarcode,
            );
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
            const blob = await catalogoApi.generatePriceTickets(selectedCurrency, payload, includeBarcode);
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
        <div style={{ padding: 16 }}>
            <Card
                bordered={false}
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
            >
                <div style={{ marginBottom: 16 }}>
                    <Title level={2} style={{ margin: 0 }}>
                        🎫 Tickets de Precios
                    </Title>
                    <Text type="secondary">
                        Genera hojas con etiquetas de precio. Actualmente: <strong>14 tickets por página</strong>.
                    </Text>
                </div>

                {/* Currency selector */}
                <Form layout="vertical" style={{ marginBottom: 16 }}>
                    <Form.Item label={t('catalog.currency_label')} style={{ width: '100%' }}>
                        <Select
                            value={selectedCurrency}
                            onChange={setSelectedCurrency}
                            style={{ minWidth: '100%' }}
                            options={currencies.map(c => ({
                                value: c.code,
                                label: `${c.name} (${c.symbol})${c.isPrimary ? ' — Principal' : ''}`
                            }))}
                        />
                    </Form.Item>
                </Form>

                {/* Toggle de código de barras */}
                <div style={{ marginBottom: 16 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong>Incluir códigos de barras:</Text>
                            <Switch
                                checked={includeBarcode}
                                onChange={setIncludeBarcode}
                            />
                        </div>
                        <Text type="secondary">14 tickets por página</Text>
                    </Space>
                </div>

                <Spin spinning={loading}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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

                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Button
                                type="primary"
                                onClick={handleFillPageWithProduct}
                                disabled={!ticketProductId}
                                loading={ticketsLoading}
                                style={{ width: '100%' }}
                            >
                                Llenar hoja completa (14 tickets del mismo producto)
                            </Button>

                            <Button
                                onClick={addToManualTickets}
                                disabled={!ticketProductId}
                                style={{ width: '100%' }}
                            >
                                + Agregar 1 ticket de este producto
                            </Button>
                        </Space>

                        {manualTicketList.length > 0 && (
                            <div>
                                <Text strong>Tickets en la lista ({manualTicketList.reduce((s, t) => s + t.quantity, 0)} total):</Text>
                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {manualTicketList.map((t, idx) => (
                                        <div key={idx} style={{
                                            background: '#f0f0f0',
                                            padding: '8px 10px',
                                            borderRadius: 6,
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
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
                                    style={{ marginTop: 12, width: '100%' }}
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
