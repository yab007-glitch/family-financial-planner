import { Router, Request, Response } from 'express';
import { validateFamilySlug } from '../middleware/familySlug';
import { sendSuccess, sendError } from '../utils/response';
import { MarketDataService } from '../services/marketData';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

router.post('/sync', async (req: Request, res: Response) => {
    try {
        const result = await MarketDataService.syncFamilyAccounts(req.familyId!);
        sendSuccess(res, result);
    } catch (err) {
        console.error('Market sync error:', err);
        sendError(res, 'Failed to sync market data', 500);
    }
});

export default router;
