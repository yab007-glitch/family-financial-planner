import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateFamilySlug } from '../middleware/familySlug';
import { validateBody } from '../middleware/validator';
import { sendSuccess, sendError } from '../utils/response';
import queries from '../db/queries';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

const importSchema = z.object({
    type: z.enum(['accounts', 'debts', 'budget']),
    items: z.array(z.any()),
});

router.post('/', validateBody(importSchema), async (req: Request, res: Response) => {
    const { type, items } = req.body;
    const f = req.familyId!;

    try {
        queries.transaction(() => {
            for (const item of items) {
                if (type === 'accounts') {
                    queries.run('INSERT INTO accounts (family_id, type, institution, balance) VALUES (?, ?, ?, ?)',
                        [f, item.type || 'Other', item.institution || '', item.balance || 0]);
                } else if (type === 'debts') {
                    queries.run('INSERT INTO debts (family_id, type, balance, interest_rate) VALUES (?, ?, ?, ?)',
                        [f, item.type || 'Other', item.balance || 0, item.interestRate || 0]);
                } else if (type === 'budget') {
                    queries.run('INSERT INTO budget_entries (family_id, month_year, category, subcategory, amount, type) VALUES (?, ?, ?, ?, ?, ?)',
                        [f, item.monthYear, item.category, item.subcategory || '', item.amount || 0, item.type || 'expense']);
                }
            }
        });
        sendSuccess(res, { imported: items.length });
    } catch (err) {
        console.error('Import error:', err);
        sendError(res, 'Failed to import data', 500);
    }
});

export default router;
