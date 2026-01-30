/**
 * Abreviatura de números grandes para evitar desbordamiento en grillas
 * Ejemplos:
 * - 1000 → "1K"
 * - 1500 → "1.5K"
 * - 1000000 → "1M"
 * - 1200000 → "1.2M"
 */
export const abbreviateNumber = (value: number | null | undefined): string => {
    // Validar que el valor sea un número válido
    if (value === null || value === undefined || isNaN(Number(value))) {
        return '0';
    }

    const numValue = Number(value);

    if (numValue < 1000) {
        return numValue.toString();
    }

    if (numValue < 1000000) {
        // Miles
        const thousands = numValue / 1000;
        if (thousands % 1 === 0) {
            return `${thousands}K`;
        } else {
            return `${thousands.toFixed(1)}K`;
        }
    } else {
        // Millones
        const millions = numValue / 1000000;
        if (millions % 1 === 0) {
            return `${millions}M`;
        } else {
            return `${millions.toFixed(1)}M`;
        }
    }
};

/**
 * Formatea un número al formato venezolano con opción de abreviar
 * - Puntos para separar miles
 * - Comas para decimales
 * - Opción para abreviar números grandes
 * Ejemplos:
 * - 31395.00 → "31.395,00"
 * - 1234.56 → "1.234,56"
 * - 1000000.00 → "1.000.000,00"
 * - 1500000.00 con abbreviate=true → "1.5M"
 */
export const formatVenezuelanNumber = (value: number | null | undefined, decimals: number = 2, abbreviate: boolean = false): string => {
    // Validar que el valor sea un número válido
    if (value === null || value === undefined || isNaN(Number(value))) {
        return '0,00';
    }

    const numValue = Number(value);

    // Si se pide abreviar y el número es grande, usar abreviatura
    if (abbreviate && numValue >= 10000) {
        return abbreviateNumber(numValue);
    }

    // Convertir a string con los decimales especificados
    const parts = numValue.toFixed(decimals).split('.');

    // Formatear la parte entera con puntos para miles
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    // Usar coma para decimales
    const decimalPart = parts[1];

    if (decimalPart) {
        return `${integerPart},${decimalPart}`;
    }

    return integerPart;
};

/**
 * Formatea un precio con símbolo de moneda en formato venezolano con opción de abreviar
 */
export const formatVenezuelanPrice = (value: number | null | undefined, currencySymbol: string = 'Bs', decimals: number = 2, abbreviate: boolean = false): string => {
    return `${formatVenezuelanNumber(value, decimals, abbreviate)} ${currencySymbol}`;
};

/**
 * Formatea un precio sin símbolo de moneda en formato venezolano con opción de abreviar
 */
export const formatVenezuelanPriceOnly = (value: number | null | undefined, decimals: number = 2, abbreviate: boolean = false): string => {
    return formatVenezuelanNumber(value, decimals, abbreviate);
};

/**
 * Formatea una fecha a formato local (DD/MM/YYYY)
 */
export const formatDate = (date: string | Date | undefined): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
};