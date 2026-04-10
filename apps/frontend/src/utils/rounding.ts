/**
 * Centralized rounding logic for prices in the ERP.
 * Always rounds up (Math.ceil) to the nearest multiple of the rounding factor.
 * 
 * @param price The original price to round
 * @param factor The rounding factor (e.g., 1, 10, 100)
 * @param enabled Whether rounding is enabled
 * @returns The rounded price
 */
export const getRoundedPrice = (price: number, factor: number, enabled: boolean): number => {
    if (!enabled || factor <= 1) {
        // If not enabled or factor is 1, we still might want to ensure no small decimals for some currencies
        // but for now, if it's 1 it's effectively "exact"
        return price;
    }
    
    return Math.ceil(price / factor) * factor;
};
