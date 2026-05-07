import { Router, Request, Response } from 'express';
import { validateFamilySlug } from '../middleware/familySlug';
import { sendError } from '../utils/response';
import queries from '../db/queries';
import { WealthOptimizer } from '../services/wealthOptimizer';
import { PdfGenerator } from '../utils/pdf/pdfGenerator';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

router.get('/pdf', async (req: Request, res: Response) => {
    try {
        const f = req.familyId!;
        const familyData = await queries.get<any>('SELECT * FROM families WHERE id = ?', [f]);
        familyData.members = await queries.all('SELECT * FROM members WHERE family_id = ?', [f]);
        familyData.accounts = await queries.all('SELECT * FROM accounts WHERE family_id = ?', [f]);
        familyData.debts = await queries.all('SELECT * FROM debts WHERE family_id = ?', [f]);
        familyData.goals = await queries.all('SELECT * FROM goals WHERE family_id = ?', [f]);

        const optimizer = new WealthOptimizer();
        const health = optimizer.calculateHealthScore(familyData);
        
        const html = await PdfGenerator.generateSummaryHtml(familyData, health);
        
        // In a real environment, we would use puppeteer or direct PDF lib here.
        // For now, we serve a printable strategy HTML which the browser can "Save as PDF"
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        console.error('PDF Report error:', err);
        sendError(res, 'Failed to generate report', 500);
    }
});

export default router;
