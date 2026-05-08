import { Router, Request, Response } from 'express';
import queries from '../db/queries';
import { validateFamilySlug } from '../middleware/familySlug';
import { sendSuccess, sendError } from '../utils/response';
import { WealthOptimizer } from '../services/wealthOptimizer';
import { EstateAnalyzer } from '../services/estateAnalyzer';
import { PulseService } from '../services/pulseService';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

router.get('/', async (req: Request, res: Response) => {
    try {
        const f = req.familyId!;
        
        const assetsRow = await queries.get<{ total: number }>('SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE family_id = ?', [f]);
        const liabilitiesRow = await queries.get<{ total: number }>('SELECT COALESCE(SUM(balance), 0) as total FROM debts WHERE family_id = ?', [f]);
        const incomeRow = await queries.get<{ total: number }>('SELECT COALESCE(SUM(amount), 0) as total FROM budget_entries WHERE family_id = ? AND type = ?', [f, 'income']);
        const expenseRow = await queries.get<{ total: number }>('SELECT COALESCE(SUM(amount), 0) as total FROM budget_entries WHERE family_id = ? AND type = ?', [f, 'expense']);

        const assets = assetsRow?.total ?? 0;
        const liabilities = liabilitiesRow?.total ?? 0;
        const netWorth = assets - liabilities;

        const totalIncome = incomeRow?.total ?? 0;
        const totalExpenses = expenseRow?.total ?? 0;
        const savingsRate = totalIncome > 0 ? parseFloat(((totalIncome - totalExpenses) / totalIncome * 100).toFixed(2)) : 0;

        // Auto-capture snapshot
        const today = new Date().toISOString().slice(0, 7);
        const existing = await queries.get('SELECT id FROM net_worth_snapshots WHERE family_id = ? AND snapshot_date = ?', [f, today]);
        if (!existing) {
            await queries.run(
                'INSERT INTO net_worth_snapshots (family_id, snapshot_date, assets, liabilities, net_worth, savings_rate) VALUES (?, ?, ?, ?, ?, ?)',
                [f, today, assets, liabilities, netWorth, savingsRate]
            );
        }

        const liquidAssetsRow = await queries.get<{ total: number }>(
            "SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE family_id = ? AND type IN ('Emergency Fund','Checking','Savings')", 
            [f]
        );

        // Compute Health Score
        const familyData = await queries.get<any>('SELECT * FROM families WHERE id = ?', [f]);
        familyData.members = await queries.all('SELECT * FROM members WHERE family_id = ?', [f]);
        familyData.accounts = await queries.all('SELECT * FROM accounts WHERE family_id = ?', [f]);
        familyData.debts = await queries.all('SELECT * FROM debts WHERE family_id = ?', [f]);
        familyData.goals = await queries.all('SELECT * FROM goals WHERE family_id = ?', [f]);

        const health = new WealthOptimizer().calculateHealthScore(familyData);
        
        // Family Pulse (Phase 6)
        const pulse = await PulseService.generateWeeklyPulse(f);

        // Comprehensive Estate Check
        const estate = EstateAnalyzer.analyzeInsuranceGap(familyData);
        if (estate.gap > 0) {
            health.categories.estate = Math.max(0, 100 - (estate.gap / 10000));
            health.alerts.push({ text: `Life Insurance Gap: $${estate.gap.toLocaleString()} needed.`, severity: estate.gap > 500000 ? 'critical' : 'warning' });
            health.recommendations.push(estate.recommendation);
        }

        sendSuccess(res, {
            assets,
            liabilities,
            netWorth,
            totalIncome,
            totalExpenses,
            savingsRate,
            debtToAssetRatio: assets > 0 ? parseFloat((liabilities / assets * 100).toFixed(2)) : 0,
            liquidAssets: liquidAssetsRow?.total ?? 0,
            health,
            estate,
            pulse
        });
    } catch (err) {
        console.error('Summary error:', err);
        sendError(res, 'An error occurred while computing summary', 500);
    }
});

export default router;