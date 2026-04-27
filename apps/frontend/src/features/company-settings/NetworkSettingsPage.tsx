import { useState, useEffect } from 'react';
import { Card, Radio, Input, Button, Space, Divider, Typography, Alert, message, Tag } from 'antd';
import { GlobalOutlined, LaptopOutlined, ShareAltOutlined, SaveOutlined, ReloadOutlined, CopyOutlined } from '@ant-design/icons';
import { setCustomApiUrl, BASE_URL, getConnectionMode } from '../../services/apiConfig';
import { systemApi } from '../../services/systemApi';
import type { NetworkInfo } from '../../services/systemApi';

const { Title, Text, Paragraph } = Typography;

/**
 * NetworkSettingsPage Component
 * Critical configuration utility for managing the application's connection to the NestJS backend.
 * Supports three modes:
 * 1. Local: Backend is running on the same machine (localhost).
 * 2. LAN: Backend is reachable via local IP (useful for mobile POS testing).
 * 3. Remote: Backend is hosted on a public URL (Cloud).
 */
export const NetworkSettingsPage = () => {
    const [mode, setMode] = useState<'local' | 'lan' | 'remote'>(getConnectionMode());
    const [customUrl, setCustomUrl] = useState(localStorage.getItem('CUSTOM_API_URL') || '');
    const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Retrieves the server's local IP and port information to assist in LAN configuration.
     */
    const loadNetworkInfo = async () => {
        setIsLoading(true);
        try {
            const data = await systemApi.getNetworkInfo();
            setNetworkInfo(data);
        } catch (error) {
            console.error('Error loading static network info:', error);
            // Non-critical error if the server is currently unreachable
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadNetworkInfo();
    }, []);

    /**
     * Persists the connection mode and triggers a hard reload to re-initialize the API services with the new BASE_URL.
     */
    const handleSave = () => {
        if (mode === 'local') {
            setCustomApiUrl(null);
            message.success('Mode switched to Local Host. The application will restart.');
        } else if (mode === 'lan') {
            if (networkInfo?.localIp) {
                const lanUrl = `http://${networkInfo.localIp}:${networkInfo.port}/api`;
                setCustomApiUrl(lanUrl);
                message.success('Mode switched to Local Network (LAN). The application will restart.');
            } else {
                message.error('Could not automatically detect the server\'s local IP.');
                return;
            }
        } else {
            if (!customUrl) {
                message.error('Please enter a valid URL for Remote mode.');
                return;
            }
            setCustomApiUrl(customUrl);
            message.success('Mode switched to Remote/Cloud. The application will restart.');
        }

        // Restart app to apply new BASE_URL environment
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        message.success('Copied to clipboard');
    };

    const lanAppUrl = networkInfo ? `${window.location.protocol}//${networkInfo.localIp}:${window.location.port}` : '';

    return (
        <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
            <div style={{ marginBottom: 32 }}>
                <Title level={2} style={{ margin: 0 }}>🌐 Network & Connectivity Settings</Title>
                <Paragraph type="secondary">
                    Configure how this frontend application communicates with the central MastERP core server.
                </Paragraph>
            </div>

            <Card bordered={false} style={{ marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Title level={4}>Server Discovery</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Text strong>Current Connection Endpoint:</Text>
                        <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>{BASE_URL}</Tag>
                        <Button
                            icon={<ReloadOutlined />}
                            size="middle"
                            onClick={loadNetworkInfo}
                            loading={isLoading}
                        >
                            Refresh Info
                        </Button>
                    </div>
                </Space>
            </Card>

            <Card bordered={false} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Title level={4}>Connection Environment</Title>
                <Radio.Group
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    style={{ marginBottom: 24 }}
                    size="large"
                >
                    <Radio.Button value="local">
                        <Space><LaptopOutlined /> Localhost (Single PC)</Space>
                    </Radio.Button>
                    <Radio.Button value="lan">
                        <Space><ShareAltOutlined /> Local Network (LAN)</Space>
                    </Radio.Button>
                    <Radio.Button value="remote">
                        <Space><GlobalOutlined /> Remote / Cloud</Space>
                    </Radio.Button>
                </Radio.Group>

                <div style={{ minHeight: 120 }}>
                    {mode === 'local' && (
                        <Alert
                            type="info"
                            message="Direct Connection"
                            description="Use this if you are running both the database/server and this interface on the same physical computer. This is the fastest and most stable configuration."
                            showIcon
                        />
                    )}

                    {mode === 'lan' && (
                        <div>
                            <Alert
                                type="warning"
                                message="Intranet Deployment"
                                description="Enable this mode to allow other devices (smartphones, tablets, auxiliary laptops) on your same Wi-Fi network to connect to this server."
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            {networkInfo && (
                                <Card size="small" style={{ background: '#fafafa', border: '1px dashed #d9d9d9' }}>
                                    <Text strong>Detected Server IP:</Text>
                                    <Paragraph copyable={{ text: networkInfo.localIp }} style={{ fontSize: '18px', marginTop: 8 }}>
                                        {networkInfo.localIp}
                                    </Paragraph>
                                    <Text type="secondary">The application will attempt to reach the backend at this internal address.</Text>
                                </Card>
                            )}
                        </div>
                    )}

                    {mode === 'remote' && (
                        <div>
                            <Alert
                                type="success"
                                message="Distributed / Cloud Connection"
                                description="Enter the full URL of your publicly hosted API (e.g., https://api.yourdomain.com/api)."
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <Input
                                placeholder="https://api.your-cloud-server.com/api"
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
                        style={{ height: 50, borderRadius: 8, padding: '0 40px' }}
                    >
                        Apply Settings & Restart App
                    </Button>
                </div>
            </Card >

            {mode === 'lan' && networkInfo && (
                <Card title="External Device Connection Guide" style={{ marginTop: 32, borderRadius: 12 }}>
                    <Paragraph>
                        To access MastERP from another device in the same building, open the browser on that device and enter:
                    </Paragraph>
                    <Title level={2} style={{ textAlign: 'center', color: '#1890ff', margin: '24px 0' }}>
                        {lanAppUrl}
                    </Title>
                    <div style={{ textAlign: 'center' }}>
                        <Button
                            size="large"
                            icon={<CopyOutlined />}
                            onClick={() => copyToClipboard(lanAppUrl)}
                        >
                            Copy Invitation Link
                        </Button>
                    </div>
                </Card>
            )}
        </div >
    );
};
