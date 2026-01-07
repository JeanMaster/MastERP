
import { Select } from 'antd';
import { usePOSStore } from '../../../store/posStore';
import { useEffect } from 'react';

interface ReportCurrencySelectorProps {
    value: string;
    onChange: (currencyCode: string) => void;
    style?: React.CSSProperties;
}

export const ReportCurrencySelector = ({ value, onChange, style }: ReportCurrencySelectorProps) => {
    const { currencies, primaryCurrency } = usePOSStore();

    // Ensure we start with a valid value if possible
    useEffect(() => {
        if (!value && primaryCurrency) {
            onChange(primaryCurrency.code);
        }
    }, [value, primaryCurrency, onChange]);

    return (
        <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Moneda:</label>
            <Select
                value={value}
                onChange={onChange}
                options={currencies.map(c => ({
                    label: `${c.name} (${c.symbol})`,
                    value: c.code
                }))}
                style={{ width: '100%', ...style }}
            />
        </div>
    );
};
