import { Router, Request, Response } from 'express';
import { z } from 'zod';
import MortgageVsInvestCalculator from '../utils/mortgage-calculator';
import { RetirementSimulator } from '../services/retirementSimulator';
import { MonteCarloEngine } from '../utils/monte-carlo';
import FHSAChecker from '../utils/fhsa-checker';
import ReportGenerator from '../utils/report-generator';
import { compareStrategies } from '../services/debtPlanner';
import { calculateGoalPlan } from '../services/goalPlanner';
import queries from '../db/queries';
import { validateFamilySlug } from '../middleware/familySlug';
import { validateBody } from '../middleware/validator';
import { sendSuccess, sendError } from '../utils/response';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

const mortgageSchema = z.object({
    mortgageAmount: z.number().positive(),
    interestRate: z.number().min(0).max(100),
    amortizationYears: z.number().int().min(1).max(40),
    paymentFrequency: z.enum(['monthly', 'biweekly', 'accelerated_biweekly']).optional(),
});

const retirementSchema = z.object({
    currentAge: z.number().int().min(0).max(120),
    desiredRetirementAge: z.number().int().min(0).max(120),
    currentSavings: z.number().min(0),
    monthlyContribution: z.number().min(0),
    expectedReturn: z.number().min(0).max(100),
    inflationRate: z.number().min(0).max(50).optional(),
});

const readinessSchema = z.object({
    currentAge: z.number().int().min(0).max(120),
    desiredRetirementAge: z.number().int().min(0).max(120),
    currentSavings: z.number().min(0),
    monthlyContribution: z.number().min(0),
    expectedReturn: z.number().min(0).max(100),
});

const monteCarloSchema = z.object({
    initialAmount: z.number().min(0),
    monthlyContribution: z.number().min(0),
    years: z.number().int().min(1).max(100),
    expectedReturn: z.number().min(0).max(100),
    volatility: z.number().min(0).max(100).optional(),
    simulations: z.number().int().min(100).max(100000).optional(),
    seed: z.number().int().optional(), // #18: Accept seed for reproducible results
});

const fhsaSchema = z.object({
    income: z.number().min(0),
    age: z.number().int().min(18).max(100),
    firstTimeHomeBuyer: z.boolean().optional(),
});

const debtStrategySchema = z.object({
    debts: z.array(z.object({
        name: z.string().min(1).max(100),
        balance: z.number().positive(),
        interestRate: z.number().min(0).max(100),
        monthlyPayment: z.number().min(0),
    })),
    extra_payment: z.number().min(0).optional(),
});

// #27: Fix goalPlanSchema to match GoalInput interface (use deadline + expectedReturn)
const goalPlanSchema = z.object({
    targetAmount: z.number().positive(),
    currentAmount: z.number().min(0),
    monthlyContribution: z.number().min(0),
    annualReturn: z.number().min(0).max(100).optional(),
    years: z.number().int().min(1).max(100).optional(),
    deadline: z.string().optional(), // ISO date string
    expectedReturn: z.number().min(0).max(100).optional(),
});

router.post('/mortgage-vs-invest', validateBody(mortgageSchema), (req: Request, res: Response) => {
    try {
        sendSuccess(res, MortgageVsInvestCalculator.compare(req.body));
    } catch (err) {
        console.error('Mortgage comparison error:', err);
        sendError(res, 'An error occurred during mortgage comparison', 500);
    }
});

router.post('/retirement-simulate', validateBody(retirementSchema), (req: Request, res: Response) => {
    try {
        sendSuccess(res, new RetirementSimulator().simulateRetirement(req.body));
    } catch (err) {
        console.error('Retirement simulation error:', err);
        sendError(res, 'An error occurred during retirement simulation', 500);
    }
});

router.post('/retirement-readiness', validateBody(readinessSchema), (req: Request, res: Response) => {
    try {
        const { currentAge, desiredRetirementAge, currentSavings, monthlyContribution, expectedReturn } = req.body;
        sendSuccess(res, RetirementSimulator.checkReadiness(currentAge, desiredRetirementAge, currentSavings, monthlyContribution, expectedReturn));
    } catch (err) {
        console.error('Retirement readiness error:', err);
        sendError(res, 'An error occurred during readiness check', 500);
    }
});

router.post('/monte-carlo', validateBody(monteCarloSchema), (req: Request, res: Response) => {
    try {
        sendSuccess(res, MonteCarloEngine.simulate(req.body));
    } catch (err) {
        console.error('Monte Carlo error:', err);
        sendError(res, 'An error occurred during Monte Carlo simulation', 500);
    }
});

router.post('/fhsa-check', validateBody(fhsaSchema), (req: Request, res: Response) => {
    try {
        sendSuccess(res, FHSAChecker.checkEligibility(req.body));
    } catch (err) {
        console.error('FHSA check error:', err);
        sendError(res, 'An error occurred during FHSA eligibility check', 500);
    }
});

router.post('/debt-strategy', validateBody(debtStrategySchema), (req: Request, res: Response) => {
    try {
        const { debts, extra_payment = 0 } = req.body;
        sendSuccess(res, compareStrategies(debts, extra_payment));
    } catch (err) {
        console.error('Debt strategy error:', err);
        sendError(res, 'An error occurred during debt strategy calculation', 500);
    }
});

// #27: Fix goal plan to handle both (years) and (deadline + expectedReturn) formats
router.post('/goal-plan', validateBody(goalPlanSchema), (req: Request, res: Response) => {
    try {
        const { targetAmount, currentAmount } = req.body;
        let monthlyContribution = req.body.monthlyContribution ?? 0;

        // Support both old format (years) and new format (deadline + expectedReturn)
        let years: number;
        if (req.body.years) {
            years = req.body.years;
        } else if (req.body.deadline) {
            const deadline = new Date(req.body.deadline);
            const now = new Date();
            years = (deadline.getFullYear() - now.getFullYear()) + (deadline.getMonth() - now.getMonth()) / 12;
            if (years < 1) years = 1;
        } else {
            return sendError(res, 'Either "years" or "deadline" must be provided', 400);
        }

        const annualReturn = req.body.annualReturn ?? req.body.expectedReturn ?? 7;
        const monthlyRate = annualReturn / 100 / 12;
        const months = years * 12;
        const fvFactor = Math.pow(1 + monthlyRate, months);

        if (monthlyContribution === 0 && monthlyRate > 0) {
            monthlyContribution = (targetAmount - (currentAmount * fvFactor)) / ((fvFactor - 1) / monthlyRate);
        }

        const totalContributed = currentAmount + (monthlyContribution * months);
        const finalValue = (currentAmount * fvFactor) + (monthlyContribution * ((fvFactor - 1) / monthlyRate));
        const totalGrowth = finalValue - totalContributed;

        sendSuccess(res, {
            monthlyContribution: Math.round(monthlyContribution * 100) / 100,
            totalContributed: Math.round(totalContributed * 100) / 100,
            totalGrowth: Math.round(totalGrowth * 100) / 100,
            finalValue: Math.round(finalValue * 100) / 100,
            isAchievable: monthlyContribution < (targetAmount / 12),
            percentFromTarget: Math.round((currentAmount / targetAmount) * 10000) / 100,
            years: Math.round(years * 10) / 10,
        });
    } catch (err) {
        console.error('Goal plan error:', err);
        sendError(res, 'An error occurred during goal plan calculation', 500);
    }
});

router.get('/export-report', async (req: Request, res: Response) => {
    try {
        const { format = 'json' } = req.query;
        const familyRaw = await queries.get<{ id: number; name: string; location: string }>('SELECT id, name, location FROM families WHERE slug = ?', [req.params.slug]);
        if (!familyRaw) return sendError(res, 'Family not found', 404);

        const family: any = { ...familyRaw };
        const id = family.id;
        family.members = await queries.all('SELECT * FROM members WHERE family_id = ?', [id]);
        family.accounts = await queries.all('SELECT * FROM accounts WHERE family_id = ?', [id]);
        family.debts = await queries.all('SELECT * FROM debts WHERE family_id = ?', [id]);
        family.insurance = await queries.all('SELECT * FROM insurance WHERE family_id = ?', [id]);
        family.goals = await queries.all('SELECT * FROM goals WHERE family_id = ? ORDER BY priority', [id]);
        family.actions = await queries.all('SELECT * FROM action_items WHERE family_id = ? ORDER BY phase', [id]);
        family.milestones = await queries.all('SELECT * FROM milestones WHERE family_id = ?', [id]);

        const report = ReportGenerator.generateWealthReport(family, null, null);
        if (format === 'csv') {
            const csv = ReportGenerator.generateTaxReport(report, 'csv');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${req.params.slug}-wealth-report.csv"`);
            return res.send(csv);
        }
        sendSuccess(res, report);
    } catch (err) {
        console.error('Export report error:', err);
        sendError(res, 'An error occurred while generating the report', 500);
    }
});

export default router;