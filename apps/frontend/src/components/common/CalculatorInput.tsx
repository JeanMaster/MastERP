import React, { useState, useEffect, useRef } from 'react';
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
    const [displayValue, setDisplayValue] = useState('');

    // Sync display value when external value changes (mostly for initialization)
    useEffect(() => {
        const formatted = value.toFixed(precision);
        setDisplayValue(formatted);
    }, [value, precision, open]); // Added open to re-sync when modal opens

    useEffect(() => {
        if (autoFocus) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [autoFocus]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Handle ENTER
        if (e.key === 'Enter' && onPressEnter) {
            onPressEnter();
            return;
        }

        // Handle Backspace
        if (e.key === 'Backspace') {
            e.preventDefault();
            const digits = displayValue.replace(/[^\d]/g, '');
            const newDigits = digits.slice(0, -1) || '0';
            const newValue = parseInt(newDigits, 10) / Math.pow(10, precision);
            onChange(newValue);
            setDisplayValue(newValue.toFixed(precision));
            return;
        }

        // Handle Numbers
        if (/^\d$/.test(e.key)) {
            e.preventDefault();
            const digits = displayValue.replace(/[^\d]/g, '');
            // Prevent too many digits (safety)
            if (digits.length > 12) return;

            const newDigits = (digits === '0' ? '' : digits) + e.key;
            const newValue = parseInt(newDigits, 10) / Math.pow(10, precision);
            onChange(newValue);
            setDisplayValue(newValue.toFixed(precision));
            return;
        }

        // Allow Tab, Escape, etc. but prevent others
        if (!['Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'Shift', 'Control', 'Alt'].includes(e.key)) {
            // If it's a character that would normally be typed (like a dot or letter), stop it
            if (e.key.length === 1) {
                e.preventDefault();
            }
        }
    };

    return (
        <Input
            ref={inputRef}
            value={displayValue}
            onKeyDown={handleKeyDown}
            size={size}
            style={{ textAlign: 'right', ...style }}
            addonAfter={addonAfter}
            status={status}
            placeholder={placeholder}
            // We use readOnly or prevent default to control the behavior entirely
            // but keeping it clickable for focus
            autoComplete="off"
        />
    );
};
