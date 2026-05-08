import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import queries from '../db/queries';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validator';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

const createSchema = z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    location: z.string().max(200).optional(),
    tax_situation: z.string().max(500).optional(),
});

const updateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    location: z.string().max(200).optional(),
    tax_situation: z.string().max(500).optional(),
});

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
    try {
        const families = await queries.all(
            'SELECT f.id, f.name, f.slug, f.location, f.tax_situation, f.created_at, m.role FROM families f JOIN family_memberships m ON f.id = m.family_id WHERE m.user_id = ? ORDER BY f.created_at DESC',
            [req.userId]
        );
        sendSuccess(res, families);
    } catch (err) {
        console.error('Fetch families error:', err);
        sendError(res, 'An error occurred while fetching families', 500);
    }
});

router.post('/', validateBody(createSchema), async (req: Request, res: Response) => {
    try {
        const { name, slug, location, tax_situation } = req.body;
        const exists = await queries.get('SELECT id FROM families WHERE slug = ?', [slug]);
        if (exists) return sendError(res, 'Slug already exists', 409);

        const result = queries.transaction(() => {
            const familyResult = queries.run(
                'INSERT INTO families (user_id, name, slug, location, tax_situation) VALUES (?, ?, ?, ?, ?)',
                [req.userId, name, slug, location ?? null, tax_situation ?? null]
            );
            const familyId = familyResult.lastID;
            
            queries.run(
                'INSERT INTO family_memberships (family_id, user_id, role) VALUES (?, ?, ?)',
                [familyId, req.userId, 'owner']
            );
            
            return { id: familyId, name, slug, location: location ?? null, tax_situation: tax_situation ?? null };
        });

        sendSuccess(res, result);
    } catch (err) {
        console.error('Create family error:', err);
        sendError(res, 'An error occurred while creating the family', 500);
    }
});

router.get('/:slug', async (req: Request, res: Response) => {
    try {
        const family = await queries.get<any>(
            'SELECT f.*, m.role FROM families f JOIN family_memberships m ON f.id = m.family_id WHERE f.slug = ? AND m.user_id = ?',
            [req.params.slug, req.userId]
        );

        if (!family) return sendError(res, 'Family not found', 404);

        const paginationSchema = z.object({
            budget_limit: z.string().optional().default('24'),
            snapshot_limit: z.string().optional().default('24'),
        });
        const parsed = paginationSchema.safeParse(req.query);
        const budgetLimit = parsed.success ? Math.min(120, Math.max(1, parseInt(parsed.data.budget_limit, 10))) : 24;
        const snapshotLimit = parsed.success ? Math.min(60, Math.max(1, parseInt(parsed.data.snapshot_limit, 10))) : 24;

        const id = family.id;
        family.members = await queries.all('SELECT * FROM members WHERE family_id = ?', [id]);
        family.accounts = await queries.all('SELECT * FROM accounts WHERE family_id = ?', [id]);
        family.debts = await queries.all('SELECT * FROM debts WHERE family_id = ?', [id]);
        family.insurance = await queries.all('SELECT * FROM insurance WHERE family_id = ?', [id]);
        family.goals = await queries.all('SELECT * FROM goals WHERE family_id = ? ORDER BY priority', [id]);
        family.budget = await queries.all('SELECT * FROM budget_entries WHERE family_id = ? ORDER BY month_year DESC LIMIT ?', [id, budgetLimit]);
        family.actions = await queries.all('SELECT * FROM action_items WHERE family_id = ? ORDER BY phase', [id]);
        family.milestones = await queries.all('SELECT * FROM milestones WHERE family_id = ?', [id]);
        family.recurring = await queries.all('SELECT * FROM recurring_items WHERE family_id = ? AND active = 1', [id]);
        family.snapshots = await queries.all('SELECT * FROM net_worth_snapshots WHERE family_id = ? ORDER BY snapshot_date DESC LIMIT ?', [id, snapshotLimit]);

        sendSuccess(res, family);
    } catch (err) {
        console.error('Fetch family error:', err);
        sendError(res, 'An error occurred while fetching the family', 500);
    }
});

router.put('/:slug', validateBody(updateSchema), async (req: Request, res: Response) => {
    try {
        const family = await queries.get<{ id: number; role: string }>(
            'SELECT f.id, m.role FROM families f JOIN family_memberships m ON f.id = m.family_id WHERE f.slug = ? AND m.user_id = ?',
            [req.params.slug, req.userId]
        );
        if (!family) return sendError(res, 'Family not found', 404);
        if (family.role === 'viewer') return sendError(res, 'Viewers cannot update family details', 403);

        const { name, location, tax_situation } = req.body;
        const updates: string[] = [];
        const values: any[] = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (location !== undefined) {
            updates.push('location = ?');
            values.push(location);
        }
        if (tax_situation !== undefined) {
            updates.push('tax_situation = ?');
            values.push(tax_situation);
        }

        if (updates.length === 0) return sendError(res, 'No fields to update', 400);

        values.push(family.id);
        await queries.run(`UPDATE families SET ${updates.join(', ')} WHERE id = ?`, values);
        sendSuccess(res, { updated: true });
    } catch (err) {
        console.error('Update family error:', err);
        sendError(res, 'An error occurred while updating the family', 500);
    }
});

router.delete('/:slug', async (req: Request, res: Response) => {
    try {
        const family = await queries.get<{ id: number; role: string }>(
            'SELECT f.id, m.role FROM families f JOIN family_memberships m ON f.id = m.family_id WHERE f.slug = ? AND m.user_id = ?',
            [req.params.slug, req.userId]
        );
        if (!family) return sendError(res, 'Family not found', 404);
        if (family.role !== 'owner') return sendError(res, 'Only the owner can delete the family', 403);

        await queries.run('DELETE FROM families WHERE id = ?', [family.id]);
        sendSuccess(res, { deleted: true });
    } catch (err) {
        console.error('Delete family error:', err);
        sendError(res, 'An error occurred while deleting the family', 500);
    }
});

router.post('/:slug/invite', validateBody(z.object({ email: z.string().email(), role: z.enum(['member', 'viewer']).optional() })), async (req: Request, res: Response) => {
    try {
        const family = await queries.get<{ id: number; role: string }>(
            'SELECT f.id, m.role FROM families f JOIN family_memberships m ON f.id = m.family_id WHERE f.slug = ? AND m.user_id = ?',
            [req.params.slug, req.userId]
        );
        if (!family || family.role !== 'owner') return sendError(res, 'Unauthorized', 403);

        const { email, role = 'member' } = req.body;
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await queries.run(
            'INSERT INTO family_invitations (family_id, email, token, role, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
            [family.id, email, token, role, req.userId, expiresAt]
        );

        sendSuccess(res, { inviteToken: token, invited: true });
    } catch (err) {
        console.error('Invite error:', err);
        sendError(res, 'Failed to send invitation', 500);
    }
});

router.post('/accept-invite', validateBody(z.object({ token: z.string() })), async (req: Request, res: Response) => {
    try {
        const invite = await queries.get<{ id: number; family_id: number; email: string; role: string; expires_at: string }>(
            'SELECT * FROM family_invitations WHERE token = ?', [req.body.token]
        );

        if (!invite) return sendError(res, 'Invalid invitation token', 404);
        if (new Date(invite.expires_at) < new Date()) return sendError(res, 'Invitation expired', 410);

        await queries.transaction(() => {
            queries.run(
                'INSERT INTO family_memberships (family_id, user_id, role) VALUES (?, ?, ?)',
                [invite.family_id, req.userId, invite.role]
            );
            queries.run('DELETE FROM family_invitations WHERE id = ?', [invite.id]);
        });

        sendSuccess(res, { accepted: true });
    } catch (err) {
        console.error('Accept invite error:', err);
        sendError(res, 'Failed to accept invitation', 500);
    }
});

export default router;
