import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import queries from '../db/queries';
import { CONFIG } from '../config';
import { validateBody } from '../middleware/validator';
import { authenticateToken, generateCsrfToken, setAuthCookies, clearAuthCookies } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';
import { AppError } from '../middleware/errorHandler';
import { AuthTokenPayload } from '../types';

const router = Router();

// #8: Stronger password policy
const registerSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be at most 128 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    name: z.string().min(1).max(100),
});

const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1),
});

function createTokenPayload(userId: number, email: string): AuthTokenPayload {
    return { userId, email };
}

function signToken(payload: object): string {
    return jwt.sign(payload, CONFIG.JWT_SECRET, {
        expiresIn: CONFIG.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
}

// #7 & #9: Track failed login attempts and lock accounts
async function checkAccountLock(email: string): Promise<void> {
    const user = await queries.get<{ id: number; failed_login_attempts: number; locked_until: string | null }>(
        'SELECT id, failed_login_attempts, locked_until FROM users WHERE email = ?', [email]
    );
    if (!user) return; // Don't reveal whether user exists

    if (user.locked_until) {
        const lockTime = new Date(user.locked_until).getTime();
        if (Date.now() < lockTime) {
            throw new AppError(`Account temporarily locked. Try again after ${new Date(lockTime).toLocaleTimeString()}.`, 429);
        }
        // Lock expired — reset it
        await queries.run('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);
    }
}

async function recordFailedLogin(email: string): Promise<void> {
    const user = await queries.get<{ id: number; failed_login_attempts: number }>(
        'SELECT id, failed_login_attempts FROM users WHERE email = ?', [email]
    );
    if (!user) return;

    const newCount = user.failed_login_attempts + 1;

    if (newCount >= CONFIG.AUTH_LOCKOUT_THRESHOLD) {
        // Lock the account
        const lockUntil = new Date(Date.now() + CONFIG.AUTH_LOCKOUT_DURATION_MS).toISOString();
        await queries.run(
            'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
            [newCount, lockUntil, user.id]
        );
    } else {
        await queries.run('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [newCount, user.id]);
    }
}

async function resetFailedLogins(userId: number): Promise<void> {
    await queries.run('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [userId]);
}

// #7: Audit logging helper
async function logAuthEvent(action: string, userId: number | null, email: string, req: Request, details: string): Promise<void> {
    try {
        await queries.run(
            'INSERT INTO audit_logs (family_id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                null, // No family for auth events
                userId,
                action,
                'auth',
                userId,
                null,
                JSON.stringify({ email, details }),
                req.ip || req.socket?.remoteAddress || 'unknown',
                req.headers['user-agent']?.toString().slice(0, 500) || 'unknown',
            ]
        );
    } catch {
        // Audit logging should not break user-facing operations
    }
}

router.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;
        const existing = await queries.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            // #13: Don't reveal whether email exists — but for registration, 409 is standard
            await logAuthEvent('register_failed', null, email, req, 'email_already_exists');
            return sendError(res, 'An account with this email already exists', 409);
        }

        const hash = await bcrypt.hash(password, CONFIG.BCRYPT_ROUNDS);
        const result = await queries.run('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', [email, hash, name]);
        const userId = result.lastID;

        const token = signToken(createTokenPayload(userId, email));
        const csrf = generateCsrfToken();

        setAuthCookies(res, token, csrf);

        // #7: Audit registration
        await logAuthEvent('register_success', userId, email, req, 'new_account');

        // #16: TODO — Email verification should be sent here in future
        sendSuccess(res, { id: userId, email, name, csrfToken: csrf });
    } catch (err) {
        // #13: Don't leak internal error details
        console.error('Registration error:', err);
        sendError(res, 'An error occurred during registration', 500);
    }
});

router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // #9: Check if account is locked
        await checkAccountLock(email);

        const user = await queries.get<{ id: number; password_hash: string; name: string }>(
            'SELECT id, password_hash, name FROM users WHERE email = ?', [email]
        );

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            // #9: Record failed login attempt
            await recordFailedLogin(email);
            await logAuthEvent('login_failed', user?.id ?? null, email, req, 'invalid_credentials');
            return sendError(res, 'Invalid email or password', 401);
        }

        // #9: Reset failed login attempts on success
        await resetFailedLogins(user.id);

        await queries.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        const token = signToken(createTokenPayload(user.id, email));
        const csrf = generateCsrfToken();

        setAuthCookies(res, token, csrf);

        // #7: Audit successful login
        await logAuthEvent('login_success', user.id, email, req, 'password_auth');

        sendSuccess(res, { id: user.id, email, name: user.name, csrfToken: csrf });
    } catch (err) {
        if (err instanceof AppError) {
            return sendError(res, err.message, err.statusCode);
        }
        console.error('Login error:', err);
        sendError(res, 'An error occurred during login', 500);
    }
});

router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
    // #7: Audit logout
    await logAuthEvent('logout', req.userId!, req.userEmail!, req, 'user_initiated');
    clearAuthCookies(res);
    sendSuccess(res, { loggedOut: true });
});

// #3: Use authenticateToken middleware instead of manual JWT check
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
    try {
        const user = await queries.get<{ id: number; email: string; name: string }>(
            'SELECT id, email, name FROM users WHERE id = ?', [req.userId]
        );

        if (!user) {
            return sendError(res, 'User not found', 404);
        }

        // Return a fresh CSRF token for the session if they don't have one
        const csrf = generateCsrfToken();
        const token = req.cookies.token; // Keep existing JWT
        setAuthCookies(res, token, csrf);

        sendSuccess(res, { id: user.id, email: user.email, name: user.name, csrfToken: csrf });
    } catch (err) {
        console.error('Get current user error:', err);
        sendError(res, 'An error occurred', 500);
    }
});

export default router;