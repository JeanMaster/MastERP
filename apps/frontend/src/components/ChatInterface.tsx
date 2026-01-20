import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Space, Typography, Avatar, Spin } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import type { AIChatMessage } from '../services/aiApi';

const { Text } = Typography;

interface ChatInterfaceProps {
    onSendMessage: (message: string, history: AIChatMessage[]) => Promise<string>;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onSendMessage }) => {
    const [messages, setMessages] = useState<AIChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim() || loading) return;

        const userMessage: AIChatMessage = {
            role: 'user',
            content: inputValue.trim(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setLoading(true);

        try {
            const response = await onSendMessage(userMessage.content, messages);
            const assistantMessage: AIChatMessage = {
                role: 'assistant',
                content: response,
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage: AIChatMessage = {
                role: 'assistant',
                content: 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.',
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '500px' }}>
            {/* Messages Area */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    background: '#fafafa',
                    borderRadius: '8px',
                    marginBottom: '16px',
                }}
            >
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8c8c8c' }}>
                        <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                        <br />
                        <Text type="secondary">
                            Pregúntame sobre tu negocio. Por ejemplo:
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            "¿Cuáles son mis productos más vendidos?"
                            <br />
                            "¿Cómo está mi flujo de caja?"
                            <br />
                            "¿Qué productos tienen stock bajo?"
                        </Text>
                    </div>
                )}

                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                gap: 8,
                            }}
                        >
                            {msg.role === 'assistant' && (
                                <Avatar icon={<RobotOutlined />} style={{ background: '#1890ff' }} />
                            )}
                            <div
                                style={{
                                    maxWidth: '70%',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    background: msg.role === 'user' ? '#1890ff' : '#fff',
                                    color: msg.role === 'user' ? '#fff' : '#262626',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                }}
                            >
                                <Text
                                    style={{
                                        color: msg.role === 'user' ? '#fff' : '#262626',
                                        whiteSpace: 'pre-wrap',
                                    }}
                                >
                                    {msg.content}
                                </Text>
                            </div>
                            {msg.role === 'user' && (
                                <Avatar icon={<UserOutlined />} style={{ background: '#52c41a' }} />
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Avatar icon={<RobotOutlined />} style={{ background: '#1890ff' }} />
                            <div
                                style={{
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    background: '#fff',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                }}
                            >
                                <Spin size="small" />
                                <Text style={{ marginLeft: 8, color: '#8c8c8c' }}>Pensando...</Text>
                            </div>
                        </div>
                    )}
                </Space>
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ display: 'flex', gap: 8 }}>
                <Input.TextArea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe tu pregunta..."
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    disabled={loading}
                    style={{ flex: 1 }}
                />
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    loading={loading}
                    disabled={!inputValue.trim()}
                    size="large"
                >
                    Enviar
                </Button>
            </div>
        </div>
    );
};
