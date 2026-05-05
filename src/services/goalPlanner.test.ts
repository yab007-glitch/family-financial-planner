import { describe, it, expect } from 'vitest';
import { calculateGoalPlan } from './goalPlanner';

describe('GoalPlanner', () => {
    it('calculates monthly contribution to reach $100,000 in 10 years', () => {
        const plan = calculateGoalPlan({
            targetAmount: 100000,
            currentAmount: 0,
            deadline: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            expectedReturn: 7,
        });
        expect(plan.monthlyContribution).toBeGreaterThan(0);
        expect(plan.finalValue).toBeGreaterThanOrEqual(100000);
    });
    it('is achievable for reasonable targets', () => {
        const plan = calculateGoalPlan({
            targetAmount: 10000,
            currentAmount: 0,
            deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            expectedReturn: 7,
        });
        expect(plan.isAchievable).toBe(true);
        expect(plan.percentFromTarget).toBe(0);
    });
});
