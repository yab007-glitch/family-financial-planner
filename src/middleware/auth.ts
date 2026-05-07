import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { CONFIG } from '../config';
import { AuthTokenPayload } from '../types';

const JWT_COOKIE = 'token';
const CSRF_HEADER = 'x-csrf-token';

// #10: CSRF token stored in httpOnly cookie, server reads it via signed double-submit
// Client sends CSRF token as a header; server compares header to the httpOnly cookie value.
// Since httpOnly cookies can't be read by JS, XSS can't steal the CSRF token.

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
        sameSite: CONFIG.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
    };

    // JWT in httpOnly cookie
    res.cookie(JWT_COOKIE, token, cookieOptions);

    // #10: CSRF token ALSO in httpOnly cookie (not readable by JS)
    // The double-submit pattern: client sends the CSRF token in a custom header,
    // which it gets from the signup/login response body. The server compares the
    // header value against the httpOnly cookie value.
    res.cookie('csrf_token', csrfToken, cookieOptions);
}

export function clearAuthCookies(res: Response): void {
    const clearOpts = { path: '/' };
    res.clearCookie(JWT_COOKIE, clearOpts);
    res.clearCookie('csrf_token', clearOpts);
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies?.token;

    if (!token) {
        res.status(401).json({ success: false, error: 'Access token required' });
        return;
    }

    try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as AuthTokenPayload;
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
    const headerToken = req.headers[CSRF_HEADER];

    if (!cookieToken || !headerToken || cookieToken !== String(headerToken)) {
        res.status(403).json({ success: false, error: 'Invalid CSRF token' });
        return;
    }

    next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies?.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as AuthTokenPayload;
            req.userId = decoded.userId;
            req.userEmail = decoded.email;
        } catch {
            // silently ignore invalid optional tokens
        }
    }
    next();
}