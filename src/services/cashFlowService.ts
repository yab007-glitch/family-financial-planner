import { FamilyDetail, BudgetEntry, RecurringItem } from '../types';
import queries from '../db/queries';

export interface LeakageAlert {
    type: 'Price Hike' | 'Double Charge' | 'Missing Subscription';
    description: string;
    amount: number;
    severity: 'warning' | 'info';
}

export class CashFlowService {
    public static async analyzeLeakage(familyId: number): Promise<LeakageAlert[]> {
        const recurring = await queries.all<RecurringItem>(
            "SELECT * FROM recurring_items WHERE family_id = ? AND active = 1",
            [familyId]
        );
        const recentEntries = await queries.all<BudgetEntry>(
            "SELECT * FROM budget_entries WHERE family_id = ? AND created_at >= date('now', '-60 days')",
            [familyId]
        );

        const alerts: LeakageAlert[] = [];

        for (const item of recurring) {
            // Find recent entries matching this recurring item name/category
            const matches = recentEntries.filter(e => 
                e.category === item.category && 
                (item.name && e.notes?.toLowerCase().includes(item.name.toLowerCase()))
            );

            if (matches.length > 0) {
                const last = matches[0];
                if (last.amount > item.amount * 1.05) {
                    alerts.push({
                        type: 'Price Hike',
                        description: `Your ${item.name} payment (\$${last.amount}) is higher than your tracked amount (\$${item.amount}).`,
                        amount: last.amount - item.amount,
                        severity: 'warning'
                    });
                }
            }
        }

        return alerts;
    }

    public static calculateRunway(family: FamilyDetail, assets: number): number {
        const expenses = (family as any).totalExpenses || 5000;
        const dailyBurn = expenses / 30;
        
        const liquidAssets = (family.accounts || [])
            .filter(a => ['Savings', 'Checking', 'Emergency Fund'].includes(a.type))
            .reduce((sum, a) => sum + (a.balance || 0), 0);

        return Math.round(liquidAssets / dailyBurn);
    }
}
