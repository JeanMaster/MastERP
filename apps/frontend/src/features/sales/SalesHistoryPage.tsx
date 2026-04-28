import { Card, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { SalesReports } from '../reports/components/SalesReports';

const { Title } = Typography;

/**
 * SalesHistoryPage Component
 * Wrapper page that embeds the SalesReports detailed view for transaction history auditing.
 */
export const SalesHistoryPage = () => {
    const { t } = useTranslation();
    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 24 }}>
                <Title level={2}>{t('sales_history.title')}</Title>
            </div>
            <Card bordered={false} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <SalesReports />
            </Card>
        </div>
    );
};
