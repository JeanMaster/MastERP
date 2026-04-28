import { useState, useEffect } from 'react';
import { Card, Radio, Input, Button, Space, Divider, Typography, Alert, App, Tag } from 'antd';
import { GlobalOutlined, LaptopOutlined, ShareAltOutlined, SaveOutlined, ReloadOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const { message } = App.useApp();
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
            message.success(t('settings.network.success_mode_local'));
        } else if (mode === 'lan') {
            if (networkInfo?.localIp) {
                const lanUrl = `http://${networkInfo.localIp}:${networkInfo.port}/api`;
                setCustomApiUrl(lanUrl);
                message.success(t('settings.network.success_mode_lan'));
            } else {
                message.error(t('settings.network.error_lan_ip'));
                return;
            }
        } else {
            if (!customUrl) {
                message.error(t('settings.network.error_remote_url'));
                return;
            }
            setCustomApiUrl(customUrl);
            message.success(t('settings.network.success_mode_remote'));
        }

        // Restart app to apply new BASE_URL environment
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        message.success(t('settings.network.copy_success'));
    };

    const lanAppUrl = networkInfo ? `${window.location.protocol}//${networkInfo.localIp}:${window.location.port}` : '';

    return (
        <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
            <div style={{ marginBottom: 32 }}>
                <Title level={2} style={{ margin: 0 }}>{t('settings.network.page_title')}</Title>
                <Paragraph type="secondary">
                    {t('settings.network.page_subtitle')}
                </Paragraph>
            </div>

            <Card bordered={false} style={{ marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Title level={4}>{t('settings.network.discovery_title')}</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Text strong>{t('settings.network.current_endpoint')}</Text>
                        <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>{BASE_URL}</Tag>
                        <Button
                            icon={<ReloadOutlined />}
                            size="middle"
                            onClick={loadNetworkInfo}
                            loading={isLoading}
                        >
                            {t('settings.network.refresh_button')}
                        </Button>
                    </div>
                </Space>
            </Card>

            <Card bordered={false} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Title level={4}>{t('settings.network.env_title')}</Title>
                <Radio.Group
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    style={{ marginBottom: 24 }}
                    size="large"
                >
                    <Radio.Button value="local">
                        <Space><LaptopOutlined /> {t('settings.network.mode_local')}</Space>
                    </Radio.Button>
                    <Radio.Button value="lan">
                        <Space><ShareAltOutlined /> {t('settings.network.mode_lan')}</Space>
                    </Radio.Button>
                    <Radio.Button value="remote">
                        <Space><GlobalOutlined /> {t('settings.network.mode_remote')}</Space>
                    </Radio.Button>
                </Radio.Group>

                <div style={{ minHeight: 120 }}>
                    {mode === 'local' && (
                        <Alert
                            type="info"
                            message={t('settings.network.local_msg_title')}
                            description={t('settings.network.local_msg_desc')}
                            showIcon
                        />
                    )}

                    {mode === 'lan' && (
                        <div>
                            <Alert
                                type="warning"
                                message={t('settings.network.lan_msg_title')}
                                description={t('settings.network.lan_msg_desc')}
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            {networkInfo && (
                                <Card size="small" style={{ background: '#fafafa', border: '1px dashed #d9d9d9' }}>
                                    <Text strong>{t('settings.network.lan_detected_ip')}</Text>
                                    <Paragraph copyable={{ text: networkInfo.localIp }} style={{ fontSize: '18px', marginTop: 8 }}>
                                        {networkInfo.localIp}
                                    </Paragraph>
                                    <Text type="secondary">{t('settings.network.lan_ip_desc')}</Text>
                                </Card>
                            )}
                        </div>
                    )}

                    {mode === 'remote' && (
                        <div>
                            <Alert
                                type="success"
                                message={t('settings.network.remote_msg_title')}
                                description={t('settings.network.remote_msg_desc')}
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <Input
                                placeholder={t('settings.network.remote_placeholder')}
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
                        {t('settings.network.apply_button')}
                    </Button>
                </div>
            </Card >

            {mode === 'lan' && networkInfo && (
                <Card title={t('settings.network.external_title')} style={{ marginTop: 32, borderRadius: 12 }}>
                    <Paragraph>
                        {t('settings.network.external_desc')}
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
                            {t('settings.network.copy_link')}
                        </Button>
                    </div>
                </Card>
            )}
        </div >
    );
};
