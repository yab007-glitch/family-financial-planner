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
        const family = await queries.get<{ id: number; user_id: number }>('SELECT id, user_id FROM families WHERE slug = ?', [slug]);

        if (!family) {
            res.status(404).json({ success: false, error: 'Family not found' });
            return;
        }

        // Ownership check is now mandatory
        if (family.user_id !== req.userId) {
            res.status(403).json({ success: false, error: 'You do not have access to this family' });
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