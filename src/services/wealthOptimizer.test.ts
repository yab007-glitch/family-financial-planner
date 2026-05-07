import { describe, it, expect } from 'vitest';
import { WealthOptimizer } from './wealthOptimizer';

describe('WealthOptimizer Health Score', () => {
    const optimizer = new WealthOptimizer();
    
    const mockFamily: any = {
        members: [{ role: 'Primary Income' }, { role: 'Child' }],
        accounts: [
            { type: 'Emergency Fund', balance: 5000 },
            { type: 'TFSA', balance: 10000 }
        ],
        debts: [
            { type: 'Credit Card', balance: 2000, interest_rate: 19.99 }
        ]
    };

    it('calculates a score based on family data', () => {
        const health = optimizer.calculateHealthScore(mockFamily);
        expect(health.score).toBeGreaterThan(0);
        expect(health.score).toBeLessThan(100);
        expect(health.alerts.length).toBeGreaterThan(0);
    });

    it('identifies critical debt alerts', () => {
        const badDebtFamily = {
            ...mockFamily,
            debts: [{ type: 'Loan', balance: 10000, interest_rate: 25 }]
        };
        const health = optimizer.calculateHealthScore(badDebtFamily);
        expect(health.alerts.some(a => a.severity === 'critical')).toBe(true);
    });

    it('rewards having an emergency fund', () => {
        const safeFamily = {
            ...mockFamily,
            accounts: [{ type: 'Emergency Fund', balance: 20000 }]
        };
        const health = optimizer.calculateHealthScore(safeFamily);
        expect(health.categories.liquidity).toBe(100);
    });
});
