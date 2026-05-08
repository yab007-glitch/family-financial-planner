import cron from 'node-cron';
import queries from '../db/queries';
import { WealthOptimizer } from '../services/wealthOptimizer';

export class SchedulerService {
    public static init() {
        // Run on the 1st of every month at 8:00 AM
        cron.schedule('0 8 1 * *', async () => {
            console.log('Running monthly family briefings...');
            await this.generateMonthlyBriefings();
        });
    }

    private static async generateMonthlyBriefings() {
        try {
            const families = await queries.all<{ id: number, name: string }>('SELECT id, name FROM families');
            
            for (const family of families) {
                // 1. Gather context
                const familyData = await queries.get<any>('SELECT * FROM families WHERE id = ?', [family.id]);
                familyData.accounts = await queries.all('SELECT * FROM accounts WHERE family_id = ?', [family.id]);
                familyData.debts = await queries.all('SELECT * FROM debts WHERE family_id = ?', [family.id]);
                familyData.members = await queries.all('SELECT * FROM members WHERE family_id = ?', [family.id]);

                // 2. Compute Health Score
                const health = new WealthOptimizer().calculateHealthScore(familyData);
                
                // 3. Log it or send email (Simulation)
                console.log(`Briefing for ${family.name}: Health Score is ${health.score}%. Top rec: ${health.recommendations[0]}`);
                
                // In a real app: emailService.send(family.owner_email, briefingTemplate(health));
            }
        } catch (err) {
            console.error('Scheduled job failed:', err);
        }
    }
}
