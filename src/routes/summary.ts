import { Router, Request, Response } from 'express';
import queries from '../db/queries';
import { validateFamilySlug } from '../middleware/familySlug';
import { sendSuccess, sendError } from '../utils/response';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

router.get('/', async (req: Request, res: Response) => {
    try {
        const f = req.familyId;
        
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

        // Auto-capture snapshot if it's a new month
        const today = new Date().toISOString().slice(0, 7); // YYYY-MM
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

        sendSuccess(res, {
            assets,
            liabilities,
            netWorth,
            totalIncome,
            totalExpenses,
            savingsRate,
            debtToAssetRatio: assets > 0 ? parseFloat((liabilities / assets * 100).toFixed(2)) : 0,
            liquidAssets: liquidAssetsRow?.total ?? 0,
        });
    } catch (err: any) {
        sendError(res, err.message, 500);
    }
});

export default router;
