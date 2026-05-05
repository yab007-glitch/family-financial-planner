import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateFamilySlug } from '../middleware/familySlug';
import { validateBody } from '../middleware/validator';
import { sendSuccess, sendError } from '../utils/response';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

const projectionSchema = z.object({
    principal: z.number().min(0).default(0),
    monthly_contribution: z.number().min(0).default(0),
    annual_rate: z.number().min(0).max(100),
    years: z.number().int().min(1).max(100),
});

interface ProjectionStep {
    year: number;
    balance: number;
    totalContributed: number;
    interestEarned: number;
}

function compoundInterestProjection(principal: number, monthlyContribution: number, annualRate: number, years: number): ProjectionStep[] {
    const monthlyRate = annualRate / 12 / 100;
    const months = years * 12;
    let balance = principal;
    const schedule: ProjectionStep[] = [];

    for (let m = 1; m <= months; m++) {
        balance = balance * (1 + monthlyRate) + monthlyContribution;
        if (m % 12 === 0) {
            const totalContributed = principal + (monthlyContribution * m);
            schedule.push({
                year: m / 12,
                balance: Math.round(balance),
                totalContributed: Math.round(totalContributed),
                interestEarned: Math.round(balance - totalContributed),
            });
        }
    }
    return schedule;
}

router.post('/', validateBody(projectionSchema), (req: Request, res: Response) => {
    try {
        const { principal, monthly_contribution, annual_rate, years } = req.body;
        const schedule = compoundInterestProjection(principal, monthly_contribution, annual_rate, years);
        sendSuccess(res, { schedule });
    } catch (err: any) {
        sendError(res, 'An error occurred during projection calculation', 500);
    }
});

export default router;
