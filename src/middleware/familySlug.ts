import { Request, Response, NextFunction } from 'express';
import queries from '../db/queries';
import { AppError } from './errorHandler';

// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
    namespace Express {
        interface Request {
            familyId?: number;
        }
    }
}

// #4: validateFamilySlug NOW requires authentication — unauthenticated requests are rejected
export async function validateFamilySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { slug } = req.params;

    if (!slug) {
        throw new AppError('Family slug is required', 400);
    }

    // #4: Authentication is now REQUIRED, not optional
    if (!req.userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
    }

    try {
        const family = await queries.get<{ id: number; role: string }>(
            'SELECT f.id, m.role FROM families f JOIN family_memberships m ON f.id = m.family_id WHERE f.slug = ? AND m.user_id = ?',
            [slug, req.userId]
        );

        if (!family) {
            // Check if family exists at all to return 403 vs 404
            const exists = await queries.get('SELECT id FROM families WHERE slug = ?', [slug]);
            if (exists) {
                res.status(403).json({ success: false, error: 'You do not have access to this family' });
            } else {
                res.status(404).json({ success: false, error: 'Family not found' });
            }
            return;
        }

        req.familyId = family.id;
        next();
    } catch (err) {
        if (err instanceof AppError) throw err;
        // #13: Don't leak database error details
        console.error('Database error during slug validation:', err);
        res.status(500).json({ success: false, error: 'An internal error occurred' });
    }
}