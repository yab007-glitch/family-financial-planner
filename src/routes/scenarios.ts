import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateFamilySlug } from '../middleware/familySlug';
import { validateBody } from '../middleware/validator';
import { sendSuccess } from '../utils/response';
import { RetirementSimulator } from '../services/retirementSimulator';
import { TaxEngine } from '../services/taxEngine';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

const scenarioSchema = z.object({
    name: z.string().min(1).max(100),
    modifications: z.object({
        monthlyContribution: z.number().optional(),
        retirementAge: z.number().optional(),
        expectedReturn: z.number().optional(),
        income: z.number().optional(),
    }),
    baseline: z.object({
        currentAge: z.number(),
        retirementAge: z.number(),
        currentSavings: z.number(),
        monthlyContribution: z.number(),
        expectedReturn: z.number(),
    })
});

router.post('/compare', validateBody(scenarioSchema), (req: Request, res: Response) => {
    const { name, modifications, baseline } = req.body;
    
    // We use checkReadiness for comparison as it's simpler for "what-if" before retirement
    const resultsBaseline = RetirementSimulator.checkReadiness(
        baseline.currentAge,
        baseline.retirementAge,
        baseline.currentSavings,
        baseline.monthlyContribution,
        baseline.expectedReturn
    );

    const modifiedParams = {
        currentAge: baseline.currentAge,
        retirementAge: modifications.retirementAge ?? baseline.retirementAge,
        currentSavings: baseline.currentSavings,
        monthlyContribution: modifications.monthlyContribution ?? baseline.monthlyContribution,
        expectedReturn: modifications.expectedReturn ?? baseline.expectedReturn,
    };

    const resultsModified = RetirementSimulator.checkReadiness(
        modifiedParams.currentAge,
        modifiedParams.retirementAge,
        modifiedParams.currentSavings,
        modifiedParams.monthlyContribution,
        modifiedParams.expectedReturn
    );

    // 3. Tax Optimization Preview
    const engine = new TaxEngine(2025);
    const income = modifications.income ?? 75000;
    const baselineTax = engine.calculateContributionImpact(income, baseline.monthlyContribution);
    const modifiedTax = engine.calculateContributionImpact(income, modifiedParams.monthlyContribution);

    sendSuccess(res, {
        name,
        comparison: {
            baseline: {
                retirementFund: resultsBaseline.projectedSavings,
                annualTaxRefund: baselineTax.totalBenefit, // Includes CCB gain
            },
            modified: {
                retirementFund: resultsModified.projectedSavings,
                annualTaxRefund: modifiedTax.totalBenefit,
            }
        },
        impact: {
            fundDifference: resultsModified.projectedSavings - resultsBaseline.projectedSavings,
            taxDifference: modifiedTax.totalBenefit - baselineTax.totalBenefit
        }
    });
});

export default router;
