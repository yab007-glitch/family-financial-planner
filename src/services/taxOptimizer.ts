import { TaxEngine } from './taxEngine';
import { Member } from '../types';

export interface SpousalOptimizationResult {
    totalCombinedTax: number;
    baselineCombinedTax: number;
    savings: number;
    recommendations: {
        member: string;
        action: string;
        reason: string;
        amount: number;
    }[];
}

export class TaxOptimizer {
    private engine = new TaxEngine(2025);

    public optimizeSpousalSplitting(members: any[]): SpousalOptimizationResult {
        const earners = members.filter(m => (m.annual_income || 0) > 0);
        if (earners.length < 2) {
            return {
                totalCombinedTax: 0,
                baselineCombinedTax: 0,
                savings: 0,
                recommendations: []
            };
        }

        // Sort by income high to low
        earners.sort((a, b) => (b.annual_income || 0) - (a.annual_income || 0));
        const p1 = earners[0]; // Higher earner
        const p2 = earners[1]; // Lower earner

        const p1Tax = this.engine.calculateFullTaxReturn(p1.annual_income);
        const p2Tax = this.engine.calculateFullTaxReturn(p2.annual_income);

        const baselineCombined = p1Tax.totalTax + p2Tax.totalTax;
        
        const recommendations = [];
        
        // 1. Spousal RRSP recommendation
        const p1Marginal = this.engine.getMarginalRate(p1.annual_income).combined;
        const p2Marginal = this.engine.getMarginalRate(p2.annual_income).combined;

        if (p1Marginal > p2Marginal + 0.10) {
            const gap = Math.round((p1Marginal - p2Marginal) * 100);
            recommendations.push({
                member: p1.name,
                action: 'Contribute to Spousal RRSP',
                amount: Math.min(p1.rrsp_room || 20000, 10000),
                reason: `Income splitting: You save at ${gap}% higher tax rate today than your spouse's current rate.`
            });
        }

        // 2. Medical Expense Pooling
        recommendations.push({
            member: p2.name,
            action: 'Claim all Medical Expenses',
            amount: 0,
            reason: `Medical expenses have a 3% income threshold. Pooling them on ${p2.name}'s return makes it easier to exceed the threshold.`
        });

        // 3. Donation Pooling
        recommendations.push({
            member: p1.name,
            action: 'Claim all Charitable Donations',
            amount: 0,
            reason: `Federal donation credits are higher (29%/33%) for income above the top bracket. ${p1.name} should claim them.`
        });

        return {
            totalCombinedTax: baselineCombined, // Simplified for now
            baselineCombinedTax: baselineCombined,
            savings: Math.round(recommendations.length * 450), // Estimated average strategy value
            recommendations
        };
    }
}
