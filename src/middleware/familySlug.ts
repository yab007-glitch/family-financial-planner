import { Request, Response, NextFunction } from 'express';
import queries from '../db/queries';

// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
    namespace Express {
        interface Request {
            familyId?: number;
        }
    }
}

export async function validateFamilySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { slug } = req.params;

    if (!slug) {
        res.status(400).json({ success: false, error: 'Family slug is required' });
        return;
    }

    try {
        const family = await queries.get<{ id: number; user_id: number }>('SELECT id, user_id FROM families WHERE slug = ?', [slug]);

        if (!family) {
            res.status(404).json({ success: false, error: 'Family not found' });
            return;
        }

        // If authenticated, ensure user owns the family
        if (req.userId && family.user_id !== req.userId) {
            res.status(403).json({ success: false, error: 'You do not have access to this family' });
            return;
        }

        req.familyId = family.id;
        next();
    } catch (err: any) {
        res.status(500).json({ success: false, error: 'Database error during slug validation' });
    }
}
