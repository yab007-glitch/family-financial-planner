import { FamilyDetail, Account, Debt, Goal, Member, HealthScoreResult } from '../types';
import { TaxEngine } from './taxEngine';

export interface WealthRecommendation {
    priority: number;
    account: string;
    action: string;
    reason: string;
    amount?: number;
    benefit?: string | number;
    returnOnInvestment?: string;
    urgency?: string;
    annualLimit?: number;
    lifetimeLimit?: number | null;
    reinvestRefund?: boolean;
    strategy?: string;
    caveat?: string;
    note?: string;
}

export class WealthOptimizer {
    private engine = new TaxEngine(2025);

    public calculateHealthScore(family: FamilyDetail): HealthScoreResult {
        const members = family.members || [];
        const accounts = family.accounts || [];
        const debts = family.debts || [];
        
        const totalAssets = accounts.reduce((s: number, a: Account) => s + (a.balance || 0), 0);
        const totalDebt = debts.reduce((s: number, d: Debt) => s + (d.balance || 0), 0);

        // Liquidity: Emergency Fund
        const liquidity = accounts.filter((a: Account) => ['Emergency Fund', 'Savings', 'Checking'].includes(a.type))
            .reduce((s: number, a: Account) => s + (a.balance || 0), 0);
        const liquidityScore = Math.min(100, (liquidity / 15000) * 100);

        // Debt Score: High interest vs low interest
        const hiDebt = debts.filter((d: Debt) => (d.interest_rate || 0) > 8).map((d: Debt) => (d.balance || 0)).reduce((s: number, d: number) => s + d, 0);
        const debtScore = hiDebt === 0 ? 100 : Math.max(0, 100 - (hiDebt / 500));

        // Savings Score: Accounts variation
        const hasTfsa = accounts.some((a: Account) => a.type === 'TFSA');
        const hasRrsp = accounts.some((a: Account) => a.type === 'RRSP');
        const hasFhsa = accounts.some((a: Account) => a.type === 'FHSA');
        const hasResp = members.some((m: Member) => m.role === 'Child') && accounts.some((a: Account) => a.type === 'RESP');
        
        let savingsScore = (hasTfsa ? 25 : 0) + (hasRrsp ? 25 : 0) + (hasFhsa ? 20 : 0);
        if (members.some((m: Member) => m.role === 'Child')) {
            savingsScore += (hasResp ? 30 : 0);
        } else {
            savingsScore += 30; // N/A bonus
        }

        // Tax Score: RRSP usage relative to income
        const earners = members.filter(m => (m as any).annual_income > 60000);
        const taxScore = earners.length === 0 ? 90 : (hasRrsp ? 95 : 45);

        const estateScore = 70; // Baseline

        const overall = Math.round((liquidityScore + debtScore + savingsScore + taxScore + estateScore) / 5);

        const recommendations: string[] = [];
        const alerts: HealthScoreResult['alerts'] = [];

        if (liquidity < 10000) {
            alerts.push({ text: 'Emergency fund is critically low.', severity: 'critical' });
            recommendations.push('Transfer at least $500/mo to a High Interest Savings Account until you reach $15,000.');
        }

        if (hiDebt > 5000) {
            alerts.push({ text: 'Expensive debt is eating your returns.', severity: 'critical' });
            recommendations.push('Use the Debt Avalanche method to pay off high-interest debt immediately.');
        }

        if (members.some((m: Member) => m.role === 'Child') && !hasResp) {
            alerts.push({ text: 'Missing free government grants (RESP).', severity: 'warning' });
            recommendations.push('Open an RESP to get 20% guaranteed match on your first $2,500/year.');
        }

        if (earners.length > 0 && !hasRrsp) {
            alerts.push({ text: 'High income with no RRSP shelter.', severity: 'warning' });
            recommendations.push('Open an RRSP to reduce your taxable income and boost your tax refund.');
        }

        return {
            score: overall,
            categories: {
                liquidity: Math.round(liquidityScore),
                debt: Math.round(debtScore),
                savings: Math.round(savingsScore),
                tax: taxScore,
                estate: estateScore
            },
            recommendations,
            alerts,
            taxWindows: this.analyzeTaxWindows(family)
        };
    }

    private analyzeTaxWindows(family: FamilyDetail) {
        const engine = new TaxEngine(2025);
        const members = family.members || [];
        const incomes = members.map(m => (m as any).annual_income || 0);
        const maxIncome = Math.max(...incomes, 0);
        
        const marginal = engine.getMarginalRate(maxIncome).combined;
        
        let windowType: 'Standard' | 'Low Tax Window' | 'Peak Earning' = 'Standard';
        let recommendation = "";

        if (maxIncome > 0 && maxIncome < 50000) {
            windowType = 'Low Tax Window';
            recommendation = "You are currently in a Low Tax Window! This is an ideal time for an 'RRSP Meltdown' or realizing capital gains at a lower tax rate.";
        } else if (maxIncome > 150000) {
            windowType = 'Peak Earning';
            recommendation = "You are in a Peak Earning year. Maximizing RRSP contributions is highly efficient right now to defer tax from your top bracket.";
        } else {
            recommendation = "Your tax situation is stable. Continue balanced TFSA/RRSP contributions.";
        }

        return {
            marginalRate: Math.round(marginal * 100),
            windowType,
            recommendation
        };
    }

    public getOptimalStrategy(income: number, age: number, family: FamilyDetail, availableCash: number): WealthRecommendation[] {
        const recommendations: WealthRecommendation[] = [];
        const marginalRate = this.engine.getMarginalRate(income).combined;
        const numChildren = family.members?.filter(m => m.role === 'Child').length || 0;

        if (numChildren > 0) {
            const allocation = Math.min(availableCash, 2500 * numChildren);
            recommendations.push({
                priority: 1,
                account: 'RESP',
                action: `Contribute $${allocation.toLocaleString()} to RESP`,
                reason: '20% guaranteed government match (CESG). Highest immediate ROI.',
                amount: allocation,
                benefit: allocation * 0.2,
                urgency: 'CRITICAL'
            });
        }

        if (marginalRate > 0.35) {
            recommendations.push({
                priority: 2,
                account: 'RRSP',
                action: 'Maximize RRSP contributions',
                reason: `Higher marginal rate (${(marginalRate * 100).toFixed(1)}%). Significant tax refund + potential CCB boost.`,
                reinvestRefund: true
            });
        } else {
            recommendations.push({
                priority: 2,
                account: 'TFSA',
                action: 'Prioritize TFSA',
                reason: 'Tax-free growth is better than a small upfront refund at your current income level.',
            });
        }

        if (age >= 18) {
            recommendations.push({
                priority: 3,
                account: 'FHSA',
                action: 'Contribute to FHSA',
                reason: 'Best hybrid for first-time buyers: RRSP-like deduction + TFSA-like tax-free withdrawal.',
            });
        }

        return recommendations;
    }
}
