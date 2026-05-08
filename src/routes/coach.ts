import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateFamilySlug } from '../middleware/familySlug';
import { validateBody } from '../middleware/validator';
import { sendSuccess, sendError } from '../utils/response';
import queries from '../db/queries';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

const chatSchema = z.object({
    message: z.string().min(1).max(1000),
});

router.post('/ask', validateBody(chatSchema), async (req: Request, res: Response) => {
    try {
        const familyId = req.familyId!;
        
        // 1. Gather context for the "AI Coach"
        const [assets, liabilities, goals, health] = await Promise.all([
            queries.get<{ total: number }>('SELECT SUM(balance) as total FROM accounts WHERE family_id = ?', [familyId]),
            queries.get<{ total: number }>('SELECT SUM(balance) as total FROM debts WHERE family_id = ?', [familyId]),
            queries.all('SELECT * FROM goals WHERE family_id = ?', [familyId]),
            // We could re-calculate health here or just use recent logs
            queries.get('SELECT * FROM net_worth_snapshots WHERE family_id = ? ORDER BY snapshot_date DESC LIMIT 1', [familyId])
        ]);

        const contextSummary = {
            netWorth: (assets?.total || 0) - (liabilities?.total || 0),
            goalCount: goals.length,
            latestSavingsRate: (health as any)?.savings_rate || 0
        };

        // 2. Logic for "Mock" AI or real LLM integration
        // In this implementation, we provide a sophisticated rule-based engine that feels like an AI coach
        // while maintaining 100% data privacy and zero cost.
        
        const msg = req.body.message.toLowerCase();
        let reply = "";

        if (msg.includes('vacation') || msg.includes('travel') || msg.includes('spend')) {
            const buffer = contextSummary.netWorth * 0.05;
            reply = `Looking at your data, you have a net worth of \$${contextSummary.netWorth.toLocaleString()}. ` +
                    `A rule of thumb for discretionary spending is staying under 5% of liquid assets. ` +
                    (buffer > 5000 ? "You're in a strong position to afford that trip!" : "It might be tight. I'd recommend topping up your emergency fund first.");
        } else if (msg.includes('insurance') || msg.includes('die') || msg.includes('protect')) {
            reply = "I've analyzed your estate. Check the 'Estate' section in your Health Score. It calculates exactly how much life insurance your family needs to stay in your current home.";
        } else if (msg.includes('tax') || msg.includes('rrsp') || msg.includes('save')) {
            reply = `Your current savings rate is ${contextSummary.latestSavingsRate}%. Increasing this by just 2% could shave years off your debt-free date. Would you like to see a what-if scenario for that?`;
        } else {
            reply = "I'm your Financial Coach. I can help with 'what-if' scenarios, insurance gap analysis, or checking if your savings rate is healthy enough for your goals. What's on your mind?";
        }

        sendSuccess(res, { 
            reply,
            contextUsed: contextSummary 
        });
    } catch (err) {
        console.error('Coach error:', err);
        sendError(res, 'Coach is taking a break. Try again later.', 500);
    }
});

export default router;
