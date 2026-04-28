import { Modal, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    
    const { data: history = [], isLoading } = useQuery({
        queryKey: ['bank-history', bankAccount?.id],
        queryFn: () => banksApi.getHistory(bankAccount!.id),
        enabled: !!bankAccount && open,
    });

    const columns = [
        {
            title: t('banks.history.date'),
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY HH:mm'),
        },
        {
            title: t('banks.history.type'),
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => (
                <Tag color={type === 'IN' ? 'green' : 'red'}>
                    {type === 'IN' ? t('banks.history.income') : t('banks.history.outcome')}
                </Tag>
            ),
        },
        {
            title: t('banks.history.category'),
            dataIndex: 'category',
            key: 'category',
            render: (cat: string) => {
                const labels: Record<string, string> = {
                    'SALE_TRANSFER': t('banks.history.categories.sale_transfer'),
                    'EXPENSE': t('banks.movements.categories.expense'),
                    'INJECTION': t('banks.movements.categories.injection'),
                    'ADJUSTMENT': t('banks.movements.categories.adjustment'),
                    'TRANSFER': t('banks.movements.categories.transfer')
                };
                return labels[cat] || cat;
            }
        },
        {
            title: t('banks.history.description'),
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: t('banks.history.amount'),
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
            title: t('banks.history.reference'),
            dataIndex: 'reference',
            key: 'reference',
        },
    ];

    return (
        <Modal
            title={`${t('banks.history.title')}: ${bankAccount?.bankName} - ${bankAccount?.accountNumber}`}
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
