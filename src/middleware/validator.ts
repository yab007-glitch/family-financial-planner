import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const message = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
            res.status(400).json({ success: false, error: `Validation error: ${message}` });
            return;
        }
        next();
    };
}

export function validateQuery(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            const message = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
            res.status(400).json({ success: false, error: `Validation error: ${message}` });
            return;
        }
        next();
    };
}
