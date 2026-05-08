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
        const hasResp = members.some((m: Member) => m.role === 'Child') && accounts.some((a: Account) => a.type === 'RESP');
        const savingsScore = (hasTfsa ? 30 : 0) + (hasRrsp ? 30 : 0) + (hasResp || !members.some((m: Member) => m.role === 'Child') ? 40 : 0);

        const estateScore = 70; // Baseline

        const overall = Math.round((liquidityScore + debtScore + savingsScore + estateScore) / 4);

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

        return {
            score: overall,
            categories: {
                liquidity: Math.round(liquidityScore),
                debt: Math.round(debtScore),
                savings: Math.round(savingsScore),
                tax: 80,
                estate: estateScore
            },
            recommendations,
            alerts
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
