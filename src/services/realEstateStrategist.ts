import { FamilyDetail, Account, Debt } from '../types';
import queries from '../db/queries';

export interface RefinanceAnalysis {
    currentLTV: number;
    unlockableEquity: number;
    estimatedNewPayment: number;
    interestSavings?: number;
    recommendation: string;
}

export class RealEstateStrategist {
    public static async analyzeRefinance(family: FamilyDetail): Promise<RefinanceAnalysis> {
        const properties = family.accounts?.filter(a => a.type === 'Real Estate') || [];
        const mortgages = family.debts?.filter(d => d.type === 'Mortgage') || [];

        if (properties.length === 0 || mortgages.length === 0) {
            return {
                currentLTV: 0,
                unlockableEquity: 0,
                estimatedNewPayment: 0,
                recommendation: 'No real estate or mortgage found to analyze.'
            };
        }

        const totalValue = properties.reduce((s, p) => s + (p.balance || 0), 0);
        const totalMortgage = mortgages.reduce((s, m) => s + (m.balance || 0), 0);
        
        const ltv = totalValue > 0 ? (totalMortgage / totalValue) * 100 : 0;
        
        // 80% LTV is the typical limit for refinancing in Canada
        const maxRefi = totalValue * 0.8;
        const unlockable = Math.max(0, maxRefi - totalMortgage);

        let recommendation = '';
        if (ltv > 80) {
            recommendation = 'Your Loan-to-Value is high. Focus on principal paydown before considering a refinance.';
        } else if (ltv < 65 && unlockable > 50000) {
            recommendation = `Safe equity found ($${Math.round(unlockable).toLocaleString()}). Consider a HELOC for emergency cash or Smith Maneuver investments.`;
        } else {
            recommendation = 'Your equity position is stable. Review rates in 6-12 months.';
        }

        return {
            currentLTV: Math.round(ltv * 10) / 10,
            unlockableEquity: Math.round(unlockable),
            estimatedNewPayment: Math.round((totalMortgage * 0.05) / 12), // Assuming 5% rate for quick check
            recommendation
        };
    }
}
