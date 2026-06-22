import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Input } from 'antd';
import type { InputRef } from 'antd';

interface CalculatorInputProps {
    value: number;
    onChange: (val: number) => void;
    precision?: number;
    size?: 'small' | 'middle' | 'large';
    style?: React.CSSProperties;
    onPressEnter?: () => void;
    addonAfter?: React.ReactNode;
    status?: '' | 'error' | 'warning';
    placeholder?: string;
    autoFocus?: boolean;
}

export const CalculatorInput: React.FC<CalculatorInputProps> = ({
    value,
    onChange,
    precision = 2,
    size = 'large',
    style,
    onPressEnter,
    addonAfter,
    status,
    placeholder,
    autoFocus = true
}) => {
    const inputRef = useRef<InputRef>(null);

    // Initialize display value as formatted string, but let user edit freely
    const formattedValue = useMemo(() => {
        return Number.isFinite(value) && value !== 0 ? value.toFixed(precision) : '';
    }, [value, precision]);

    const [displayValue, setDisplayValue] = useState(formattedValue);

    // Sync display value when modal opens (value changes from external)
    useEffect(() => {
        if (inputRef.current && document.activeElement !== inputRef.current.input) {
            setDisplayValue(formattedValue);
        }
    }, [formattedValue]);

    useEffect(() => {
        if (autoFocus) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [autoFocus]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && onPressEnter) {
            onPressEnter();
        }
        // No preventDefault - allows natural input flow on mobile and desktop
    };

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newVal = e.target.value;
            setDisplayValue(newVal);
            const numericValue = parseFloat(newVal) || 0;
            onChange(numericValue);
        },
        [onChange]
    );

    return (
        <Input
            ref={inputRef}
            value={displayValue}
            onKeyDown={handleKeyDown}
            onChange={handleInputChange}
            size={size}
            style={{ textAlign: 'right', ...style }}
            addonAfter={addonAfter}
            status={status}
            placeholder={placeholder}
            inputMode="decimal"
            autoComplete="off"
        />
    );
};
