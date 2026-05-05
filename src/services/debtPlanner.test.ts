import { describe, it, expect } from 'vitest';
import { compareStrategies } from './debtPlanner';

describe('DebtPlanner', () => {
    const debts = [
        { name: 'Credit Card', balance: 5000, interestRate: 19.99, monthlyPayment: 200 },
        { name: 'Car Loan', balance: 15000, interestRate: 5.9, monthlyPayment: 350 },
        { name: 'Student Loan', balance: 8000, interestRate: 4.5, monthlyPayment: 150 },
    ];
    it('avalanche saves more interest than snowball', () => {
        const result = compareStrategies(debts, 500);
        expect(result.interestSaved).toBeGreaterThan(0);
        expect(result.winner).toBe('avalanche');
    });
    it('pays off faster with extra payments', () => {
        const noExtra = compareStrategies(debts, 0);
        const withExtra = compareStrategies(debts, 500);
        expect(withExtra.avalanche.monthsToPayoff).toBeLessThan(noExtra.avalanche.monthsToPayoff);
    });
    it('reports payoff order', () => {
        const result = compareStrategies(debts, 0);
        expect(result.avalanche.firstPayoffOrder.length).toBeGreaterThan(0);
    });
});
