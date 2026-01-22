import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Button, message, Spin } from 'antd';
import { RobotOutlined, BulbOutlined, MessageOutlined, ReloadOutlined } from '@ant-design/icons';
import { InsightsPanel } from './InsightsPanel';
import { ChatInterface } from './ChatInterface';
import { aiApi, type AIInsightsResponse, type AIChatMessage } from '../services/aiApi';

interface AIAssistantModalProps {
    visible: boolean;
    onClose: () => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ visible, onClose }) => {
    const [insights, setInsights] = useState<AIInsightsResponse | null>(null);
    const [loadingInsights, setLoadingInsights] = useState(false);
    const [activeTab, setActiveTab] = useState('insights');

    useEffect(() => {
        if (visible && !insights) {
            fetchInsights();
        }
    }, [visible]);

    const fetchInsights = async (forceRefresh = false) => {
        setLoadingInsights(true);
        try {
            const data = await aiApi.getDailyInsights(forceRefresh);
            setInsights(data);
        } catch (error: any) {
            console.error('Error fetching insights:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Error al cargar recomendaciones. Verifica tu conexión.';
            message.error(errorMsg);
            throw error; // Rethrow so the caller (handleRefresh) knows it failed
        } finally {
            setLoadingInsights(false);
        }
    };

    const handleRefresh = async () => {
        message.loading({ content: 'Regenerando recomendaciones...', key: 'refresh' });
        try {
            await fetchInsights(true);
            message.success({ content: 'Recomendaciones actualizadas', key: 'refresh' });
        } catch (error) {
            message.error({ content: 'Error al actualizar', key: 'refresh' });
        }
    };

    const handleSendMessage = async (msg: string, history: AIChatMessage[]): Promise<string> => {
        try {
            const response = await aiApi.sendChatMessage({
                message: msg,
                conversationHistory: history,
            });
            return response.response;
        } catch (error) {
            console.error('Error sending chat message:', error);
            throw error;
        }
    };

    const tabItems = [
        {
            key: 'insights',
            label: (
                <span>
                    <BulbOutlined /> Insights Diarios
                </span>
            ),
            children: loadingInsights ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <Spin size="large" />
                    <p style={{ marginTop: 16, color: '#8c8c8c' }}>Analizando tu negocio...</p>
                </div>
            ) : (
                <InsightsPanel
                    recommendations={insights?.recommendations || []}
                    loading={loadingInsights}
                />
            ),
        },
        {
            key: 'chat',
            label: (
                <span>
                    <MessageOutlined /> Pregúntame
                </span>
            ),
            children: <ChatInterface onSendMessage={handleSendMessage} />,
        },
    ];

    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RobotOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                    <span style={{ fontSize: 18, fontWeight: 600 }}>Asesor Financiero IA</span>
                </div>
            }
            open={visible}
            onCancel={onClose}
            footer={null}
            width={800}
            styles={{ body: { padding: '16px 0' } }}
        >
            <div style={{ marginBottom: 16, paddingLeft: 24, paddingRight: 24 }}>
                {activeTab === 'insights' && (
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={handleRefresh}
                        loading={loadingInsights}
                        type="dashed"
                    >
                        Regenerar Recomendaciones
                    </Button>
                )}
                {insights?.generatedAt && activeTab === 'insights' && (
                    <span style={{ marginLeft: 16, color: '#8c8c8c', fontSize: 12 }}>
                        Última actualización: {new Date(insights.generatedAt).toLocaleString('es-VE')}
                    </span>
                )}
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
                style={{ paddingLeft: 8, paddingRight: 8 }}
            />
        </Modal>
    );
};
