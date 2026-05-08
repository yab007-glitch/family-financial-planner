import { Router, Request, Response } from 'express';
import { validateFamilySlug } from '../middleware/familySlug';
import { sendSuccess, sendError } from '../utils/response';
import queries from '../db/queries';
import { TaxOptimizer } from '../services/taxOptimizer';
import { RealEstateStrategist } from '../services/realEstateStrategist';
import { EstateAnalyzer } from '../services/estateAnalyzer';
import { TaxPrepService } from '../services/taxPrepService';
import { WithdrawalOptimizer } from '../services/withdrawalOptimizer';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

router.get('/insights', async (req: Request, res: Response) => {
    try {
        const f = req.familyId!;
        const members = await queries.all('SELECT * FROM members WHERE family_id = ?', [f]);
        const familyData: any = await queries.get('SELECT * FROM families WHERE id = ?', [f]);
        familyData.accounts = await queries.all('SELECT * FROM accounts WHERE family_id = ?', [f]);
        familyData.debts = await queries.all('SELECT * FROM debts WHERE family_id = ?', [f]);
        familyData.members = members;

        const taxOpt = new TaxOptimizer();
        const spousal = taxOpt.optimizeSpousalSplitting(members);
        
        const realEstate = await RealEstateStrategist.analyzeRefinance(familyData);
        
        const estateTransfer = EstateAnalyzer.simulateProbate(familyData);
        
        const taxChecklist = TaxPrepService.generateChecklist(familyData);

        const withdrawalOpt = new WithdrawalOptimizer();
        const withdrawals = withdrawalOpt.compareStrategies({
            desiredSpending: 60000, // Default for now
            rrsp: familyData.accounts.filter((a: any) => a.type === 'RRSP').reduce((sum: number, a: any) => sum + a.balance, 0),
            tfsa: familyData.accounts.filter((a: any) => a.type === 'TFSA').reduce((sum: number, a: any) => sum + a.balance, 0),
            nonReg: familyData.accounts.filter((a: any) => a.type === 'Non-registered').reduce((sum: number, a: any) => sum + a.balance, 0),
            cpp: 12000, // Estimates
            oas: 8000,
            taxProvince: familyData.location || 'QC'
        });

        const history = await queries.all(
            'SELECT snapshot_date as date, net_worth as value FROM net_worth_snapshots WHERE family_id = ? ORDER BY snapshot_date ASC LIMIT 24',
            [f]
        );

        sendSuccess(res, {
            spousalTax: spousal,
            realEstate,
            estateTransfer,
            taxChecklist,
            withdrawals,
            history
        });
    } catch (err) {
        console.error('Wealth insights error:', err);
        sendError(res, 'Failed to generate wealth insights', 500);
    }
});

export default router;
