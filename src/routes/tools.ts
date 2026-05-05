import { Router, Request, Response } from 'express';
import { z } from 'zod';
import MortgageVsInvestCalculator from '../utils/mortgage-calculator';
import { RetirementSimulator } from '../utils/retirement-simulator';
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
});

const fhsaSchema = z.object({
    income: z.number().min(0),
    age: z.number().int().min(18).max(100),
    firstTimeBuyer: z.boolean().optional(),
});

const debtStrategySchema = z.object({
    debts: z.array(z.object({
        name: z.string().min(1),
        balance: z.number().positive(),
        interestRate: z.number().min(0).max(100),
        monthlyPayment: z.number().min(0),
    })),
    extra_payment: z.number().min(0).optional(),
});

const goalPlanSchema = z.object({
    targetAmount: z.number().positive(),
    currentAmount: z.number().min(0),
    monthlyContribution: z.number().min(0),
    annualReturn: z.number().min(0).max(100),
    years: z.number().int().min(1).max(100),
});

router.post('/mortgage-vs-invest', validateBody(mortgageSchema), (req: Request, res: Response) => {
    try {
        sendSuccess(res, MortgageVsInvestCalculator.compare(req.body));
    } catch (err) {
        sendError(res, 'An error occurred during mortgage comparison', 500);
    }
});

router.post('/retirement-simulate', validateBody(retirementSchema), (req: Request, res: Response) => {
    try {
        sendSuccess(res, new RetirementSimulator().simulateRetirement(req.body));
    } catch (err) {
        sendError(res, 'An error occurred during retirement simulation', 500);
    }
});

router.post('/retirement-readiness', validateBody(readinessSchema), (req: Request, res: Response) => {
    try {
        const { currentAge, desiredRetirementAge, currentSavings, monthlyContribution, expectedReturn } = req.body;
        sendSuccess(res, RetirementSimulator.checkReadiness(currentAge, desiredRetirementAge, currentSavings, monthlyContribution, expectedReturn));
    } catch (err) {
        sendError(res, 'An error occurred during readiness check', 500);
    }
});

router.post('/monte-carlo', validateBody(monteCarloSchema), (req: Request, res: Response) => {
    try {
        sendSuccess(res, MonteCarloEngine.simulate(req.body));
    } catch (err) {
        sendError(res, 'An error occurred during Monte Carlo simulation', 500);
    }
});

router.post('/fhsa-check', validateBody(fhsaSchema), (req: Request, res: Response) => {
    try {
        sendSuccess(res, FHSAChecker.checkEligibility(req.body));
    } catch (err) {
        sendError(res, 'An error occurred during FHSA eligibility check', 500);
    }
});

router.post('/debt-strategy', validateBody(debtStrategySchema), (req: Request, res: Response) => {
    try {
        const { debts, extra_payment = 0 } = req.body;
        sendSuccess(res, compareStrategies(debts, extra_payment));
    } catch (err) {
        sendError(res, 'An error occurred during debt strategy calculation', 500);
    }
});

router.post('/goal-plan', validateBody(goalPlanSchema), (req: Request, res: Response) => {
    try {
        sendSuccess(res, calculateGoalPlan(req.body));
    } catch (err) {
        sendError(res, 'An error occurred during goal plan calculation', 500);
    }
});

router.get('/export-report', async (req: Request, res: Response) => {
    try {
        const { format = 'json' } = req.query;
        const familyRaw = await queries.get<{ id: number; name: string }>('SELECT id, name, location FROM families WHERE slug = ?', [req.params.slug]);
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
        sendError(res, 'An error occurred while generating the report', 500);
    }
});

export default router;
