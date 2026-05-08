import { Account, FamilyDetail } from '../types';
import queries from '../db/queries';

export interface RebalanceInstruction {
    accountName: string;
    assetClass: string;
    currentValue: number;
    targetValue: number;
    difference: number;
    action: 'Buy' | 'Sell' | 'Hold';
}

export interface PortfolioHealth {
    totalValue: number;
    drift: number; // Overall % drift from target
    instructions: RebalanceInstruction[];
    cashDrag: {
        excessCash: number;
        recommendation: string | null;
    };
}

export class PortfolioService {
    public static async analyzePortfolio(familyId: number, family: FamilyDetail): Promise<PortfolioHealth> {
        const accounts = family.accounts || [];
        const totalValue = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
        
        if (totalValue === 0) {
            return { totalValue: 0, drift: 0, instructions: [], cashDrag: { excessCash: 0, recommendation: null } };
        }

        // 1. Group by Asset Class
        const classes: Record<string, { current: number, target: number, accounts: Account[] }> = {};
        
        accounts.forEach(a => {
            const cls = a.asset_class || 'Other';
            if (!classes[cls]) classes[cls] = { current: 0, target: 0, accounts: [] };
            classes[cls].current += a.balance || 0;
            classes[cls].target += (a.target_percent || 0); // Note: we'll normalize this
            classes[cls].accounts.push(a);
        });

        // Normalize target percents to ensure they sum to something meaningful or use absolute %
        const instructions: RebalanceInstruction[] = [];
        let totalAbsoluteDrift = 0;

        for (const [cls, data] of Object.entries(classes)) {
            const currentWeight = (data.current / totalValue) * 100;
            const targetWeight = data.target;
            const drift = currentWeight - targetWeight;
            
            if (targetWeight > 0) {
                totalAbsoluteDrift += Math.abs(drift);
                
                const targetValueForClass = (targetWeight / 100) * totalValue;
                const difference = targetValueForClass - data.current;

                instructions.push({
                    accountName: cls, // Grouped by class for the summary
                    assetClass: cls,
                    currentValue: Math.round(data.current),
                    targetValue: Math.round(targetValueForClass),
                    difference: Math.round(difference),
                    action: Math.abs(drift) < 2 ? 'Hold' : (difference > 0 ? 'Buy' : 'Sell')
                });
            }
        }

        // 2. Cash Drag Detection
        const cashBalance = classes['Cash']?.current || 0;
        const monthlyExpenses = await this.estimateMonthlyExpenses(familyId);
        const bufferMonths = (family as any).cash_buffer_months || 3;
        const requiredBuffer = monthlyExpenses * bufferMonths;
        const excessCash = Math.max(0, cashBalance - requiredBuffer);

        return {
            totalValue: Math.round(totalValue),
            drift: Math.round(totalAbsoluteDrift / 2), // Averaged drift
            instructions,
            cashDrag: {
                excessCash: Math.round(excessCash),
                recommendation: excessCash > 1000 
                    ? `You have ${Math.round(excessCash).toLocaleString()} in excess cash. Consider moving it to your TFSA or RRSP to avoid inflation drag.`
                    : null
            }
        };
    }

    private static async estimateMonthlyExpenses(familyId: number): Promise<number> {
        const row = await queries.get<{ total: number }>(
            "SELECT SUM(amount) as total FROM budget_entries WHERE family_id = ? AND type = 'expense' AND month_year >= date('now', '-3 months')",
            [familyId]
        );
        return (row?.total || 15000) / 3; // Default to 5000 if no data
    }
}
