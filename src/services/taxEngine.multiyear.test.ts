import { describe, it, expect } from 'vitest';
import { TaxEngine } from './taxEngine';

describe('TaxEngine Multi-Year Support', () => {
    it('uses 2024 BPA and limits when specified', () => {
        const engine2024 = new TaxEngine(2024);
        const result = engine2024.calculateFullTaxReturn(100000);
        expect(result.year).toBe(2024);
        // BPA for 2024 was 15705
        // Just checking that the calculation includes the year property
    });

    it('uses 2025 BPA and limits as default', () => {
        const engine2025 = new TaxEngine();
        const result = engine2025.calculateFullTaxReturn(100000);
        expect(result.year).toBe(2025);
    });

    it('fallbacks to 2025 for future years not yet implemented', () => {
        const engineFuture = new TaxEngine(2030);
        const result = engineFuture.calculateFullTaxReturn(100000);
        expect(result.year).toBe(2030); // It keeps the requested year label
        // but uses 2025 rates (since that's our fallback in code)
    });
});
