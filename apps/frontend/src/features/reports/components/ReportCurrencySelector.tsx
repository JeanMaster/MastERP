import { Select } from 'antd';
import { usePOSStore } from '../../../store/posStore';
import { useEffect } from 'react';

interface ReportCurrencySelectorProps {
    value: string;
    onChange: (currencyCode: string) => void;
    style?: React.CSSProperties;
}

/**
 * ReportCurrencySelector Component
 * A shared utility for switching the valuation currency across all reporting modules.
 */
export const ReportCurrencySelector = ({ value, onChange, style }: ReportCurrencySelectorProps) => {
    const { currencies, primaryCurrency } = usePOSStore();

    // Default to the system's primary currency if no selection is present
    useEffect(() => {
        if (!value && primaryCurrency) {
            onChange(primaryCurrency.code);
        }
    }, [value, primaryCurrency, onChange]);

    return (
        <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: '12px', color: '#666' }}>
                View in Currency:
            </label>
            <Select
                value={value}
                onChange={onChange}
                options={currencies.map(c => ({
                    label: `${c.name} (${c.symbol})`,
                    value: c.code
                }))}
                style={{ width: '100%', ...style }}
                size="middle"
            />
        </div>
    );
};
