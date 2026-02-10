import { Button, Typography, Grid } from 'antd';
import {
    ShoppingCartOutlined,
    UserOutlined,
    SaveOutlined,
    ReloadOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

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
            minWidth: '90px', // Allow auto width but minimum
            display: 'flex',
            flexDirection: 'row', // Cambiar a horizontal
            alignItems: 'center',
            justifyContent: 'center',
            background: color,
            border: '1px solid #d9d9d9',
            padding: '0 15px',
            gap: 8
        }}
        onClick={onClick}
    >
        {/* F-Key pequeña en la esquina o integrada */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
            <Text type="secondary" style={{ fontSize: 9 }}>{fKey}</Text>
            <Text strong style={{ fontSize: 11 }}>{label}</Text>
        </div>
        {/* Icono a la derecha */}
        {icon && <div style={{ fontSize: 18 }}>{icon}</div>}
    </Button>
);

interface POSFooterProps {
    onClientClick?: () => void;
    onCheckoutClick?: () => void;
    onCajaClick?: () => void;
}

export const POSFooter = ({ onClientClick, onCheckoutClick, onCajaClick }: POSFooterProps) => {
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
            {/* Botones de Función */}
            <div style={{ display: 'flex', gap: isMobile ? 5 : 10, flexWrap: 'wrap' }}>
                <FunctionKey
                    fKey="F3"
                    label={isMobile ? "" : "Cliente"}
                    icon={<UserOutlined />}
                    onClick={onClientClick}
                />
                {!isMobile && (
                    <>
                        <FunctionKey
                            fKey="F10"
                            label="Caja"
                            icon={<SaveOutlined />}
                            onClick={onCajaClick}
                        />
                        <FunctionKey fKey="F11" label="Cargar" icon={<ReloadOutlined />} />
                    </>
                )}
            </div>

            {/* Botón Totalizar - Más destacado en móvil */}
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
                <span>{isMobile ? "Pagar" : "F9 Totalizar"}</span>
            </Button>

            {!isMobile && (
                <FunctionKey
                    fKey="SUPR"
                    label="Reset"
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
