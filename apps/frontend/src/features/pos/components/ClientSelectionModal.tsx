import { useState, useEffect, useRef } from 'react';
import { Modal, Input, List, Button, Tag, Space, Typography } from 'antd';
import { SearchOutlined, UserAddOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { clientsApi, type Client } from '../../../services/clientsApi';
import { ClientFormModal } from '../../clients/ClientFormModal';
import debounce from 'lodash/debounce';

interface ClientSelectionModalProps {
    open: boolean;
    onSelect: (client: Client) => void;
    onCancel: () => void;
}

/**
 * ClientSelectionModal Component
 * Search and select interface for customers within the POS workflow.
 * Allows quick creation of new clients without leaving the checkout flow.
 */
export const ClientSelectionModal = ({ open, onSelect, onCancel }: ClientSelectionModalProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Focus search on open
    const searchInputRef = useRef<any>(null);

    const searchClients = async (term: string) => {
        setLoading(true);
        try {
            const data = await clientsApi.getAll(term);
            setClients(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Debounced search to prevent excessive API calls
    const debouncedSearch = debounce(searchClients, 500);

    useEffect(() => {
        if (open) {
            searchClients(''); // Load initial recent/all clients
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [open]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        debouncedSearch(val);
    };

    return (
        <Modal
            title="Select Customer"
            open={open}
            onCancel={onCancel}
            footer={[
                <Button key="new" type="primary" icon={<UserAddOutlined />} onClick={() => setIsCreateModalOpen(true)}>
                    New Customer (F2)
                </Button>,
                <Button key="close" onClick={onCancel}>
                    Close
                </Button>
            ]}
            width={600}
        >
            <Input
                ref={searchInputRef}
                prefix={<SearchOutlined />}
                placeholder="Search by Name, ID (RIF) or Email..."
                value={searchTerm}
                onChange={handleSearchChange}
                style={{ marginBottom: 15 }}
                size="large"
                onKeyDown={(e) => {
                    if (e.key === 'F2') {
                        e.preventDefault();
                        setIsCreateModalOpen(true);
                    }
                }}
            />

            <List
                loading={loading}
                itemLayout="horizontal"
                dataSource={clients}
                style={{ maxHeight: 400, overflowY: 'auto' }}
                renderItem={(item) => (
                    <List.Item
                        actions={[<Button type="link" onClick={() => onSelect(item)}>Select</Button>]}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onSelect(item)}
                    >
                        <List.Item.Meta
                            title={
                                <Space>
                                    <Tag color="blue">{item.id}</Tag>
                                    <Typography.Text strong>{item.name}</Typography.Text>
                                    {item.hasWhatsapp && <WhatsAppOutlined style={{ color: 'green' }} />}
                                </Space>
                            }
                            description={
                                <div>
                                    {item.email && <div>{item.email}</div>}
                                    {item.address && <div style={{ fontSize: 11 }}>{item.address}</div>}
                                </div>
                            }
                        />
                    </List.Item>
                )}
            />

            <ClientFormModal
                open={isCreateModalOpen}
                client={null}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    searchClients(searchTerm); // Refresh list after creation
                }}
            />
        </Modal>
    );
};
