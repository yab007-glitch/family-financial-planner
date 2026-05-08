import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateFamilySlug } from '../middleware/familySlug';
import { validateBody } from '../middleware/validator';
import { sendSuccess, sendError } from '../utils/response';
import queries from '../db/queries';

import { CategorizationService } from '../services/categorizationService';
import { CurrencyService } from '../services/currencyService';

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
        const processedItems: any[] = [];
        
        // Enhance items before insertion
        for (const item of items) {
            let processed = { ...item };
            
            if (type === 'budget') {
                // #1: Intelligent Categorization
                if (!item.category || item.category === 'Uncategorized') {
                    const mapped = await CategorizationService.categorize(f, item.description || '');
                    processed.category = mapped.category;
                    processed.subcategory = mapped.subcategory;
                }
                
                // #2: Multi-Currency Support (Convert to CAD if not already)
                if (item.currency && item.currency !== 'CAD') {
                    processed.amount = await CurrencyService.convert(item.amount, item.currency, 'CAD');
                }
            }
            processedItems.push(processed);
        }

        queries.transaction(() => {
            for (const item of processedItems) {
                if (type === 'accounts') {
                    queries.run('INSERT INTO accounts (family_id, type, institution, balance, currency) VALUES (?, ?, ?, ?, ?)',
                        [f, item.type || 'Other', item.institution || '', item.balance || 0, item.currency || 'CAD']);
                } else if (type === 'debts') {
                    queries.run('INSERT INTO debts (family_id, type, balance, interest_rate) VALUES (?, ?, ?, ?)',
                        [f, item.type || 'Other', item.balance || 0, item.interestRate || 0]);
                } else if (type === 'budget') {
                    queries.run('INSERT INTO budget_entries (family_id, month_year, category, subcategory, amount, type, currency) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [f, item.monthYear, item.category, item.subcategory || '', item.amount || 0, item.type || 'expense', item.currency || 'CAD']);
                }
            }
        });
        sendSuccess(res, { imported: processedItems.length });
    } catch (err) {
        console.error('Import error:', err);
        sendError(res, 'Failed to import data', 500);
    }
});

export default router;
