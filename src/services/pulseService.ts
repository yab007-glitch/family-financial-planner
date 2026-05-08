import queries from '../db/queries';
import { FamilyDetail } from '../types';
import { WealthOptimizer } from './wealthOptimizer';

export interface PulseNarrative {
    title: string;
    body: string;
    sentiment: 'positive' | 'neutral' | 'warning';
}

export class PulseService {
    public static async generateWeeklyPulse(familyId: number): Promise<PulseNarrative> {
        // 1. Gather recent snapshots and budget data
        const snapshots = await queries.all<any>(
            "SELECT * FROM net_worth_snapshots WHERE family_id = ? ORDER BY snapshot_date DESC LIMIT 2",
            [familyId]
        );
        
        const recentExpenses = await queries.get<{ total: number }>(
            "SELECT SUM(amount) as total FROM budget_entries WHERE family_id = ? AND type = 'expense' AND created_at >= date('now', '-7 days')",
            [familyId]
        );

        const recentIncome = await queries.get<{ total: number }>(
            "SELECT SUM(amount) as total FROM budget_entries WHERE family_id = ? AND type = 'income' AND created_at >= date('now', '-7 days')",
            [familyId]
        );

        let title = "Your Weekly Pulse";
        let body = "";
        let sentiment: 'positive' | 'neutral' | 'warning' = 'neutral';

        // 2. Build narrative logic
        if (snapshots.length >= 2) {
            const growth = snapshots[0].net_worth - snapshots[1].net_worth;
            if (growth > 0) {
                body += `Your net worth grew by \$${Math.round(growth).toLocaleString()} since last report! `;
                sentiment = 'positive';
            } else if (growth < 0) {
                body += `Your net worth slipped by \$${Math.round(Math.abs(growth)).toLocaleString()}. `;
                sentiment = 'warning';
            }
        }

        const income = recentIncome?.total || 0;
        const expenses = recentExpenses?.total || 0;
        
        if (income > expenses && expenses > 0) {
            body += `Efficiency check: You saved \$${Math.round(income - expenses).toLocaleString()} this week. `;
            if (sentiment === 'neutral') sentiment = 'positive';
        } else if (expenses > income && income > 0) {
            body += `Budget alert: Spending exceeded income by \$${Math.round(expenses - income).toLocaleString()} this week. `;
            sentiment = 'warning';
        }

        if (body === "") {
            body = "No significant changes detected this week. Keeping your data up to date will help me find more insights!";
        } else {
            body += "Keep up the consistent tracking—it's the foundation of your wealth journey.";
        }

        return { title, body, sentiment };
    }
}
