import { Modal, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { banksApi, type BankAccount, type BankMovement } from '../../../services/banksApi';
import dayjs from 'dayjs';

const { Text } = Typography;

interface BankHistoryModalProps {
    open: boolean;
    bankAccount: BankAccount | null;
    onClose: () => void;
}

/**
 * BankHistoryModal Component
 * Displays the movement history for a specific bank account.
 */
export const BankHistoryModal = ({ open, bankAccount, onClose }: BankHistoryModalProps) => {
    const { data: history = [], isLoading } = useQuery({
        queryKey: ['bank-history', bankAccount?.id],
        queryFn: () => banksApi.getHistory(bankAccount!.id),
        enabled: !!bankAccount && open,
    });

    const columns = [
        {
            title: 'Date',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY HH:mm'),
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => (
                <Tag color={type === 'IN' ? 'green' : 'red'}>
                    {type === 'IN' ? 'INCOME' : 'OUTCOME'}
                </Tag>
            ),
        },
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
            render: (cat: string) => {
                const labels: Record<string, string> = {
                    'SALE_TRANSFER': 'Sales Transfer',
                    'EXPENSE': 'Expense',
                    'INJECTION': 'Capital Injection',
                    'ADJUSTMENT': 'Adjustment',
                    'TRANSFER': 'Transfer'
                };
                return labels[cat] || cat;
            }
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            align: 'right' as const,
            render: (amount: number, record: BankMovement) => (
                <Text type={record.type === 'IN' ? 'success' : 'danger'} strong>
                    {record.type === 'IN' ? '+' : '-'} {Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
            ),
        },
        {
            title: 'Ref',
            dataIndex: 'reference',
            key: 'reference',
        },
    ];

    return (
        <Modal
            title={`History: ${bankAccount?.bankName} - ${bankAccount?.accountNumber}`}
            open={open}
            onCancel={onClose}
            footer={null}
            width={1000}
        >
            <Table
                loading={isLoading}
                dataSource={history}
                columns={columns}
                rowKey="id"
                pagination={{ pageSize: 10 }}
            />
        </Modal>
    );
};
