import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from './errorHandler';

// #15: Sanitize and validate request bodies
function sanitizeStrings(obj: any, maxDepth: number = 10): any {
    if (maxDepth <= 0) return obj;
    if (typeof obj === 'string') {
        // Trim whitespace and enforce max length
        return obj.length > 50000 ? obj.slice(0, 50000) : obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeStrings(item, maxDepth - 1));
    }
    if (obj !== null && typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            if (key.length > 100) continue; // Skip absurdly long keys
            result[key] = sanitizeStrings(obj[key], maxDepth - 1);
        }
        return result;
    }
    return obj;
}

export function validateBody(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        // #15: Sanitize before validation
        req.body = sanitizeStrings(req.body);

        const result = schema.safeParse(req.body);
        if (!result.success) {
            const message = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new AppError(`Validation error: ${message}`, 400);
        }
        next();
    };
}

export function validateQuery(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            const message = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new AppError(`Validation error: ${message}`, 400);
        }
        next();
    };
}