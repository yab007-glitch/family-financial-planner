import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { CONFIG } from '../config';

const JWT_COOKIE = 'token';
const CSRF_COOKIE = 'csrf_token';

// Extend Request to include user info
// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
    namespace Express {
        interface Request {
            userId?: number;
            userEmail?: string;
        }
    }
}

export function generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

export function setAuthCookies(res: Response, token: string, csrfToken: string): void {
    const cookieOptions = {
        httpOnly: true,
        secure: CONFIG.COOKIE_SECURE,
        sameSite: CONFIG.COOKIE_SAME_SITE as any,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
    };

    res.cookie(JWT_COOKIE, token, cookieOptions);
    res.cookie(CSRF_COOKIE, csrfToken, {
        ...cookieOptions,
        httpOnly: false,
    });
}

export function clearAuthCookies(res: Response): void {
    res.clearCookie(JWT_COOKIE, { path: '/' });
    res.clearCookie(CSRF_COOKIE, { path: '/' });
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies?.token;

    if (!token) {
        res.status(401).json({ success: false, error: 'Access token required' });
        return;
    }

    try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as { userId: number; email: string };
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        next();
    } catch {
        clearAuthCookies(res);
        res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
}

export function validateCsrf(req: Request, res: Response, next: NextFunction): void {
    const cookieToken = req.cookies?.csrf_token;
    const headerToken = req.headers['x-csrf-token'];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        res.status(403).json({ success: false, error: 'Invalid CSRF token' });
        return;
    }

    next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies?.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as { userId: number; email: string };
            req.userId = decoded.userId;
            req.userEmail = decoded.email;
        } catch {
            // silently ignore invalid optional tokens
        }
    }
    next();
}
