import { Router, Request, Response } from 'express';
import { validateFamilySlug } from '../middleware/familySlug';
import { sendSuccess, sendError } from '../utils/response';
import queries from '../db/queries';
import { PortfolioService } from '../services/portfolioService';
import { FamilyDetail } from '../types';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

router.get('/analysis', async (req: Request, res: Response) => {
    try {
        const familyId = req.familyId!;
        const family: any = await queries.get('SELECT * FROM families WHERE id = ?', [familyId]);
        family.accounts = await queries.all('SELECT * FROM accounts WHERE family_id = ?', [familyId]);
        
        const analysis = await PortfolioService.analyzePortfolio(familyId, family as FamilyDetail);
        sendSuccess(res, analysis);
    } catch (err) {
        console.error('Portfolio analysis error:', err);
        sendError(res, 'Failed to analyze portfolio', 500);
    }
});

router.post('/targets', async (req: Request, res: Response) => {
    try {
        const { targets } = req.body; // Array of { id: number, asset_class: string, target_percent: number }
        
        await queries.transaction(() => {
            for (const t of targets) {
                queries.run(
                    'UPDATE accounts SET asset_class = ?, target_percent = ? WHERE id = ? AND family_id = ?',
                    [t.asset_class, t.target_percent, t.id, req.familyId]
                );
            }
        });
        
        sendSuccess(res, { updated: true });
    } catch (err) {
        console.error('Update targets error:', err);
        sendError(res, 'Failed to update targets', 500);
    }
});

export default router;
