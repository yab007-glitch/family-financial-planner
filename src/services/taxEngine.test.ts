import { describe, it, expect } from 'vitest';
import { TaxEngine } from './taxEngine';

describe('TaxEngine 2025', () => {
    const engine = new TaxEngine(2025);
    it('calculates federal tax correctly for $50,000 income', () => {
        const tax = engine.calculateFederalTax(50000);
        expect(tax).toBeCloseTo(50000 * 0.15, 1);
    });
    it('calculates combined marginal rate for $80,000', () => {
        const rate = engine.getMarginalRate(80000);
        expect(rate.combined).toBe(0.3712); // Mid bracket
    });
    it('calculates RRSP/Contribution impact', () => {
        const impact = engine.calculateContributionImpact(80000, 10000);
        expect(impact.totalBenefit).toBeGreaterThan(2000);
        expect(impact.effectiveRecoveryRate).toBeGreaterThan(20);
    });
    it('returns optimal strategy with RESP first when children exist', () => {
        const strategy = engine.getOptimalSavingsOrder(80000, 38, 2);
        expect(strategy[0].account).toBe('RESP');
    });
    it('recommends TFSA first for low marginal rate', () => {
        const strategy = engine.getOptimalSavingsOrder(40000, 38, 0);
        expect(strategy[0].account).not.toBe('RESP');
        expect(strategy.some(s => s.account === 'TFSA')).toBe(true);
    });
});
