
import { useState, useEffect } from 'react';
import { Card, Radio, Input, Button, Space, Divider, Typography, Alert, message, Tag } from 'antd';
import { GlobalOutlined, LaptopOutlined, ShareAltOutlined, SaveOutlined, ReloadOutlined, CopyOutlined } from '@ant-design/icons';
import { setCustomApiUrl, BASE_URL, getConnectionMode } from '../../services/apiConfig';
import { systemApi } from '../../services/systemApi';
import type { NetworkInfo } from '../../services/systemApi';

const { Title, Text, Paragraph } = Typography;

export const NetworkSettingsPage = () => {
    const [mode, setMode] = useState<'local' | 'lan' | 'remote'>(getConnectionMode());
    const [customUrl, setCustomUrl] = useState(localStorage.getItem('CUSTOM_API_URL') || '');
    const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const loadNetworkInfo = async () => {
        setIsLoading(true);
        try {
            const data = await systemApi.getNetworkInfo();
            setNetworkInfo(data);
        } catch (error) {
            console.error('Error loading static network info:', error);
            // Don't show error message here as it might be expected if offline
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadNetworkInfo();
    }, []);

    const handleSave = () => {
        if (mode === 'local') {
            setCustomApiUrl(null);
            message.success('Modo cambiado a Computadora Local. La aplicación se reiniciará.');
        } else if (mode === 'lan') {
            if (networkInfo?.localIp) {
                const lanUrl = `http://${networkInfo.localIp}:${networkInfo.port}/api`;
                setCustomApiUrl(lanUrl);
                message.success('Modo cambiado a Red Local (LAN). La aplicación se reiniciará.');
            } else {
                message.error('No se pudo detectar la IP local automáticamente.');
                return;
            }
        } else {
            if (!customUrl) {
                message.error('Debe ingresar una URL para el modo remoto.');
                return;
            }
            setCustomApiUrl(customUrl);
            message.success('Modo cambiado a Remoto. La aplicación se reiniciará.');
        }

        // Restart app to apply new BASE_URL
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        message.success('Copiado al portapapeles');
    };

    const lanAppUrl = networkInfo ? `${window.location.protocol}//${networkInfo.localIp}:${window.location.port}` : '';

    return (
        <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
            <Title level={2}>Configuración de Red y Conexión</Title>
            <Paragraph>
                Configure cómo esta aplicación se comunica con el servidor central de MastERP.
            </Paragraph>

            <Card style={{ marginBottom: 24 }}>
                <Title level={4}>Detección del Servidor</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Text strong>Estado de la Conexión:</Text>
                        <Tag color="blue">{BASE_URL}</Tag>
                        <Button
                            icon={<ReloadOutlined />}
                            size="small"
                            onClick={loadNetworkInfo}
                            loading={isLoading}
                        >
                            Refrescar Info
                        </Button>
                    </div>
                </Space>
            </Card>

            <Card>
                <Title level={4}>Modo de Conexión</Title>
                <Radio.Group
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    style={{ marginBottom: 24 }}
                >
                    <Radio.Button value="local">
                        <Space><LaptopOutlined /> Computadora Local</Space>
                    </Radio.Button>
                    <Radio.Button value="lan">
                        <Space><ShareAltOutlined /> Red Local (LAN)</Space>
                    </Radio.Button>
                    <Radio.Button value="remote">
                        <Space><GlobalOutlined /> Remoto / Nube</Space>
                    </Radio.Button>
                </Radio.Group>

                <div style={{ minHeight: 120 }}>
                    {mode === 'local' && (
                        <Alert
                            type="info"
                            message="Uso en la misma computadora"
                            description="Seleccione esto si está ejecutando el sistema y el servidor en la misma PC físicamente. No requiere configuración adicional."
                            showIcon
                        />
                    )}

                    {mode === 'lan' && (
                        <div>
                            <Alert
                                type="warning"
                                message="Conexión en Red Local"
                                description="Utilice este modo para permitir que otros dispositivos (celulares, laptops) en su misma red Wi-Fi se conecten al servidor de esta computadora."
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            {networkInfo && (
                                <Card size="small" style={{ background: '#f5f5f5' }}>
                                    <Text strong>IP detectada del servidor:</Text>
                                    <Paragraph copyable={{ text: networkInfo.localIp }}>
                                        {networkInfo.localIp}
                                    </Paragraph>
                                    <Text type="secondary">Esta dirección será usada para apuntar al backend.</Text>
                                </Card>
                            )}
                        </div>
                    )}

                    {mode === 'remote' && (
                        <div>
                            <Alert
                                type="success"
                                message="Conexión Remota (Cloud)"
                                description="Ingrese la dirección de su servidor en la nube (ej. Railway, Render, VPS)."
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <Input
                                placeholder="http://mi-servidor.com/api"
                                value={customUrl}
                                onChange={(e) => setCustomUrl(e.target.value)}
                                style={{ marginBottom: 12 }}
                                size="large"
                            />
                        </div>
                    )}
                </div>

                <Divider />

                <div style={{ textAlign: 'right' }}>
                    <Button
                        type="primary"
                        size="large"
                        icon={<SaveOutlined />}
                        onClick={handleSave}
                    >
                        Guardar y Reiniciar Aplicación
                    </Button>
                </div>
            </Card >

            {mode === 'lan' && networkInfo && (
                <Card title="Guía de Conexión para Otros Dispositivos" style={{ marginTop: 24 }}>
                    <Paragraph>
                        Para que otro dispositivo entre a MastERP, abra el navegador en ese dispositivo e ingrese:
                    </Paragraph>
                    <Title level={3} style={{ textAlign: 'center', color: '#1890ff' }}>
                        {lanAppUrl}
                    </Title>
                    <div style={{ textAlign: 'center' }}>
                        <Button
                            icon={<CopyOutlined />}
                            onClick={() => copyToClipboard(lanAppUrl)}
                        >
                            Copiar Enlace de Invitación
                        </Button>
                    </div>
                </Card>
            )}
        </div >
    );
};
