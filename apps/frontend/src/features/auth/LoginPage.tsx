import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Divider, Segmented } from 'antd';
import { UserOutlined, LockOutlined, BarcodeOutlined } from '@ant-design/icons';
import { useAuth } from './AuthProvider';
import { authApi } from '../../services/authApi';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

/**
 * LoginPage Component
 * The entry point for authenticated users.
 * Handles credential validation and provides quick access to the standalone Price Checker utility.
 * Supports internationalization (i18n).
 */
export const LoginPage = () => {
    const { login } = useAuth();
    const { t, i18n } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const onFinish = async (values: any) => {
        setLoading(true);
        setError('');
        try {
            const { access_token, user } = await authApi.login({
                username: values.username,
                password: values.password
            });

            login(access_token, user);
        } catch (err: any) {
            console.error('Login failed', err);
            if (!err.response) {
                setError(t('auth.error_network'));
            } else if (err.response.status === 401) {
                setError(t('auth.error_invalid'));
            } else {
                setError(t('auth.error_server'));
            }
        } finally {
            setLoading(false);
        }
    };

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: '#f8fafc',
            backgroundImage: 'radial-gradient(at 0% 0%, hsla(210, 100%, 93%, 1) 0, transparent 50%), radial-gradient(at 50% 0%, hsla(225, 39%, 30%, 0.1) 0, transparent 50%)',
            position: 'relative'
        }}>
            {/* Language Switcher in Corner */}
            <div style={{ position: 'absolute', top: 24, right: 24 }}>
                <Segmented
                    options={[
                        { label: 'ES', value: 'es' },
                        { label: 'EN', value: 'en' },
                    ]}
                    value={i18n.language.startsWith('es') ? 'es' : 'en'}
                    onChange={(val) => changeLanguage(val as string)}
                />
            </div>

            <Card style={{ width: 400, borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: 'none' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ 
                        width: 64, 
                        height: 64, 
                        background: '#1e293b', 
                        borderRadius: '16px', 
                        margin: '0 auto 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <img src="/favicon.svg" alt="Logo" style={{ width: 40, height: 40 }} />
                    </div>
                    <Title level={2} style={{ margin: 0, fontWeight: 700 }}>MastERP</Title>
                    <Text type="secondary">{t('auth.title')}</Text>
                </div>

                {error && (
                    <Alert
                        message={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 24, borderRadius: '8px' }}
                    />
                )}

                <Form
                    name="login"
                    initialValues={{ remember: true }}
                    onFinish={onFinish}
                    layout="vertical"
                    size="large"
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: t('auth.username_required') }]}
                    >
                        <Input 
                            prefix={<UserOutlined style={{ color: '#94a3b8' }} />} 
                            placeholder={t('auth.username_placeholder')} 
                            style={{ borderRadius: '8px' }} 
                            autoComplete="username"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: t('auth.password_required') }]}
                    >
                        <Input.Password 
                            prefix={<LockOutlined style={{ color: '#94a3b8' }} />} 
                            placeholder={t('auth.password_placeholder')} 
                            style={{ borderRadius: '8px' }} 
                            autoComplete="current-password"
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 8 }}>
                        <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 48, borderRadius: '8px', fontWeight: 600 }}>
                            {t('auth.sign_in')}
                        </Button>
                    </Form.Item>
                </Form>

                <Divider plain><Text type="secondary" style={{ fontSize: '12px' }}>{t('auth.or')}</Text></Divider>

                <Button
                    type="default"
                    block
                    size="large"
                    icon={<BarcodeOutlined />}
                    onClick={() => window.location.href = '/visor'}
                    style={{ 
                        borderColor: '#1e293b', 
                        color: '#1e293b', 
                        height: 48, 
                        borderRadius: '8px',
                        fontWeight: 500
                    }}
                >
                    {t('auth.open_visor')}
                </Button>
            </Card>
        </div >
    );
};
