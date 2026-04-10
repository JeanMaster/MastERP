import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Divider } from 'antd';
import { UserOutlined, LockOutlined, BarcodeOutlined } from '@ant-design/icons';
import { useAuth } from './AuthProvider';
import axios from 'axios';
import { BASE_URL } from '../../services/apiConfig';

const { Title } = Typography;
const API_URL = BASE_URL;

export const LoginPage = () => {
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const onFinish = async (values: any) => {
        setLoading(true);
        setError('');
        try {
            const response = await axios.post(`${API_URL}/auth/login`, {
                username: values.username,
                password: values.password
            });

            const { access_token, user } = response.data;
            login(access_token, user);
        } catch (err: any) {
            console.error('Login failed', err);
            if (!err.response) {
                setError(`No se pudo conectar al servidor. Revisa la configuración de red. (Usando: ${API_URL})`);
            } else if (err.response.status === 401) {
                setError('Usuario o contraseña incorrectos');
            } else {
                setError('Error en el servidor al intentar iniciar sesión');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: '#f0f2f5'
        }}>
            <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={3}>MastERP</Title>
                    <Typography.Text type="secondary">Inicia sesión para continuar</Typography.Text>
                </div>

                {error && (
                    <Alert
                        message={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 24 }}
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
                        rules={[{ required: true, message: 'Ingresa tu usuario' }]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="Usuario" />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Contraseña" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={loading}>
                            Ingresar
                        </Button>
                    </Form.Item>
                </Form>

                <Divider>O</Divider>

                <Button
                    type="default"
                    block
                    size="large"
                    icon={<BarcodeOutlined />}
                    onClick={() => window.location.href = '/visor'}
                    style={{ borderColor: '#1890ff', color: '#1890ff' }}
                >
                    Abrir Visor de Precios
                </Button>
            </Card>
        </div >
    );
};
