import { Button, Typography, Grid } from 'antd';
import {
    ShoppingCartOutlined,
    UserOutlined,
    SaveOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

/**
 * FunctionKey Internal Component
 * Displays a keyboard shortcut button with a label and icon.
 */
const FunctionKey = ({
    fKey,
    label,
    icon,
    color = '#fff',
    onClick
}: {
    fKey: string;
    label: string;
    icon?: React.ReactNode;
    color?: string;
    onClick?: () => void
}) => (
    <Button
        style={{
            height: '50px',
            minWidth: '90px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            background: color,
            border: '1px solid #d9d9d9',
            padding: '0 15px',
            gap: 8
        }}
        onClick={onClick}
    >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
            <Text type="secondary" style={{ fontSize: 9 }}>{fKey}</Text>
            <Text strong style={{ fontSize: 11 }}>{label}</Text>
        </div>
        {icon && <div style={{ fontSize: 18 }}>{icon}</div>}
    </Button>
);

interface POSFooterProps {
    onClientClick?: () => void;
    onCheckoutClick?: () => void;
    onCajaClick?: () => void;
    onCouponClick?: () => void;
}

/**
 * POSFooter Component
 * Bottom bar of the POS interface.
 * Contains global keyboard shortcut buttons and the main Checkout (Totalize) button.
 */
export const POSFooter = ({ onClientClick, onCheckoutClick, onCajaClick, onCouponClick }: POSFooterProps) => {
    const { t } = useTranslation();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;

    return (
        <div style={{
            padding: isMobile ? '5px 10px' : '10px 20px',
            background: '#e6e6e6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: isMobile ? 5 : 10,
            width: '100%'
        }}>
            {/* Action Shortcut Buttons */}
            <div style={{ display: 'flex', gap: isMobile ? 5 : 10, flexWrap: 'wrap' }}>
                <FunctionKey
                    fKey="F3"
                    label={isMobile ? "" : t('pos.header.customer')}
                    icon={<UserOutlined />}
                    onClick={onClientClick}
                />
                <FunctionKey
                    fKey="F2"
                    label={isMobile ? "" : t('pos.footer.coupons')}
                    icon={<ShoppingCartOutlined />}
                    onClick={onCouponClick}
                />
                {!isMobile && (
                    <>
                        <FunctionKey
                            fKey="F10"
                            label={t('pos.header.register')}
                            icon={<SaveOutlined />}
                            onClick={onCajaClick}
                        />
                        <FunctionKey 
                            fKey="F11" 
                            label={t('common.reload') || 'Reload'} 
                            icon={<ReloadOutlined />} 
                        />
                    </>
                )}
            </div>

            {/* Principal Checkout Button */}
            <Button
                type="primary"
                style={{
                    height: isMobile ? '45px' : '50px',
                    minWidth: isMobile ? '120px' : '200px',
                    flex: isMobile ? 1 : 'unset',
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: isMobile ? 14 : 16
                }}
                onClick={onCheckoutClick}
            >
                <ShoppingCartOutlined style={{ fontSize: isMobile ? 20 : 24 }} />
                <span>{isMobile ? t('pos.footer.process') : `F9 ${t('pos.footer.checkout')}`}</span>
            </Button>

            {!isMobile && (
                <FunctionKey
                    fKey="DEL"
                    label={t('pos.footer.clear')}
                    icon={<ReloadOutlined />}
                    color="#fff1f0"
                    onClick={() => {
                        import('../../../store/posStore').then(({ usePOSStore }) => {
                            usePOSStore.getState().resetPOS();
                        });
                    }}
                />
            )}
        </div>
    );
};
