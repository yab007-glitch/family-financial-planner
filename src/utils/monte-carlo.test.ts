import { describe, it, expect } from 'vitest';
import { MonteCarloEngine } from './monte-carlo';

describe('MonteCarloEngine Seeding', () => {
    const options = {
        initialAmount: 100000,
        monthlyContribution: 1000,
        years: 10,
        expectedReturn: 7,
        volatility: 15,
        simulations: 100,
        seed: 12345
    };

    it('produces identical results with the same seed', () => {
        const result1 = MonteCarloEngine.simulate(options);
        const result2 = MonteCarloEngine.simulate(options);
        
        expect(result1.medianEndValue).toBe(result2.medianEndValue);
        expect(result1.successRate).toBe(result2.successRate);
        expect(result1.percentiles['90th']).toBe(result2.percentiles['90th']);
    });

    it('produces different results with different seeds', () => {
        const result1 = MonteCarloEngine.simulate({ ...options, seed: 11111 });
        const result2 = MonteCarloEngine.simulate({ ...options, seed: 22222 });
        
        // While theoretically possible to be identical, it's highly improbable
        expect(result1.medianEndValue).not.toBe(result2.medianEndValue);
    });

    it('handles zero success correctly', () => {
        const failureOptions = {
            ...options,
            initialAmount: 1000,
            monthlyContribution: -500, // Losing money
            years: 20
        };
        const result = MonteCarloEngine.simulate(failureOptions);
        expect(result.successRate).toBeLessThan(100);
    });
});
