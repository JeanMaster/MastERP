import { Modal, InputNumber, Button, Space } from 'antd';
import { useEffect, useRef, useState } from 'react';

interface QuantityModalProps {
    open: boolean;
    currentQuantity: number;
    productName: string;
    onOk: (quantity: number) => void;
    onCancel: () => void;
}

export const QuantityModal = ({ open, currentQuantity, productName, onOk, onCancel }: QuantityModalProps) => {
    const [quantity, setQuantity] = useState(1);
    const inputRef = useRef<any>(null);

    // Keyboard listener for F9
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (open && e.key === 'F9') {
                e.stopPropagation();
                e.preventDefault();
                handleSubmit();
            }
        };

        if (open) {
            window.addEventListener('keydown', handleGlobalKeyDown, true);
        }

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown, true);
        };
    }, [open, quantity]);

    // Initialization logic (only when modal opens)
    useEffect(() => {
        if (open) {
            setQuantity(currentQuantity);
            // Focus after a tiny delay to ensure modal is rendered
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [open, currentQuantity]);

    const handleSubmit = () => {
        onOk(quantity);
    };

    return (
        <Modal
            title="Cambiar Cantidad"
            open={open}
            onOk={handleSubmit}
            onCancel={onCancel}
            width={300}
            footer={null} // Custom footer for better control or just ENTER key usage
            styles={{ body: { padding: '20px 0' } }}
            centered
        >
            <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: 15, fontWeight: 'bold' }}>{productName}</p>

                <Space direction="vertical" style={{ width: '100%' }}>
                    <InputNumber
                        ref={inputRef}
                        value={quantity}
                        precision={3}
                        onChange={(val) => setQuantity(val || 1)}
                        min={0.001}
                        size="large"
                        style={{ width: '100%' }}
                        onPressEnter={handleSubmit}
                        autoFocus
                    />

                    <div style={{ marginTop: 15, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={onCancel}>Cancelar</Button>
                        <Button type="primary" onClick={handleSubmit}>Aceptar (F9)</Button>
                    </div>
                </Space>
            </div>
        </Modal>
    );
};
