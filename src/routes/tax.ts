import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { TaxEngine } from '../services/taxEngine';
import { validateFamilySlug } from '../middleware/familySlug';
import { validateBody } from '../middleware/validator';
import { sendSuccess, sendError } from '../utils/response';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

const calcSchema = z.object({ 
    income: z.number().positive(), 
    rrsp_contribution: z.number().min(0).optional() 
});

const marginalSchema = z.object({ 
    income: z.number().positive() 
});

const impactSchema = z.object({ 
    income: z.number().positive(), 
    rrsp_contribution: z.number().positive() 
});

const respSchema = z.object({ 
    contribution: z.number().min(0), 
    num_children: z.number().int().min(0).max(20).optional() 
});

const strategySchema = z.object({ 
    income: z.number().positive(), 
    age: z.number().int().min(0), 
    num_children: z.number().int().min(0).optional(), 
    available_cash: z.number().min(0).optional() 
});

router.post('/calculate', validateBody(calcSchema), (req: Request, res: Response) => {
    try {
        const { income, rrsp_contribution = 0 } = req.body;
        const engine = new TaxEngine(2025);
        sendSuccess(res, engine.calculateFullTaxReturn(income, rrsp_contribution));
    } catch (err: any) {
        sendError(res, 'An error occurred during tax calculation', 500);
    }
});

router.post('/marginal-rate', validateBody(marginalSchema), (req: Request, res: Response) => {
    try {
        const { income } = req.body;
        const engine = new TaxEngine(2025);
        sendSuccess(res, engine.getMarginalRate(income));
    } catch (err: any) {
        sendError(res, 'An error occurred while calculating marginal rate', 500);
    }
});

router.post('/rrsp-impact', validateBody(impactSchema), (req: Request, res: Response) => {
    try {
        const { income, rrsp_contribution } = req.body;
        const engine = new TaxEngine(2025);
        sendSuccess(res, engine.calculateRRSPImpact(income, rrsp_contribution));
    } catch (err: any) {
        sendError(res, 'An error occurred while calculating RRSP impact', 500);
    }
});

router.post('/resp-cesg', validateBody(respSchema), (req: Request, res: Response) => {
    try {
        const { contribution, num_children = 1 } = req.body;
        const engine = new TaxEngine(2025);
        sendSuccess(res, engine.calculateResCESG(contribution, num_children));
    } catch (err: any) {
        sendError(res, 'An error occurred while calculating RESP/CESG', 500);
    }
});

router.post('/strategy', validateBody(strategySchema), (req: Request, res: Response) => {
    try {
        const { income, age, num_children = 0, available_cash = 0 } = req.body;
        const engine = new TaxEngine(2025);
        const strategy = engine.getOptimalSavingsOrder(income, age, num_children);
        const marginal = engine.getMarginalRate(income);
        
        const yearOnePlan: any[] = [];
        if (available_cash > 0) {
            let remaining = available_cash;
            for (const step of strategy) {
                if (remaining <= 0) break;
                
                let allocation = 0;
                let benefit: string | undefined;

                if (step.account === 'RESP' && num_children > 0) {
                    allocation = Math.min(2500 * num_children, remaining);
                    const cesg = engine.calculateResCESG(allocation, num_children);
                    benefit = `+$${cesg.annualGrant.toLocaleString()} CESG`;
                } else if (step.account === 'TFSA') {
                    allocation = Math.min(7000, remaining);
                } else if (step.account === 'RRSP' || step.account.includes('RRSP')) {
                    const limit = Math.min(income * 0.18, 32490);
                    allocation = Math.min(limit, remaining);
                    const impact = engine.calculateRRSPImpact(income, allocation);
                    benefit = `+$${impact.taxRefund.toLocaleString()} refund`;
                } else if (step.account === 'FHSA') {
                    allocation = Math.min(8000, remaining);
                    const impact = engine.calculateRRSPImpact(income, allocation);
                    benefit = `+$${impact.taxRefund.toLocaleString()} deduction`;
                }

                if (allocation > 0) {
                    yearOnePlan.push({ 
                        ...step, 
                        allocation, 
                        remainingAfter: Math.round((remaining - allocation) * 100) / 100, 
                        benefit 
                    });
                    remaining -= allocation;
                }
            }
            if (remaining > 0) {
                yearOnePlan.push({ priority: 99, account: 'Non-registered / Mortgage', allocation: remaining });
            }
        }

        sendSuccess(res, { 
            income, 
            age, 
            num_children, 
            marginal_rate: marginal.combined, 
            strategy, 
            year_one_plan: yearOnePlan 
        });
    } catch (err: any) {
        sendError(res, 'An error occurred while generating strategy', 500);
    }
});

export default router;
