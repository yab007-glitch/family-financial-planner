import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import queries from '../db/queries';
import { CONFIG } from '../config';
import { validateBody } from '../middleware/validator';
import { generateCsrfToken, setAuthCookies, clearAuthCookies } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().min(1).max(100),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

function createTokenPayload(userId: number, email: string) {
    return { userId, email };
}

function signToken(payload: object): string {
    return jwt.sign(payload, CONFIG.JWT_SECRET, {
        expiresIn: CONFIG.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
}

router.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;
        const existing = await queries.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return sendError(res, 'Email already registered', 409);
        }

        const hash = await bcrypt.hash(password, CONFIG.BCRYPT_ROUNDS);
        const result = await queries.run('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', [email, hash, name]);
        const userId = result.lastID;

        const token = signToken(createTokenPayload(userId, email));
        const csrf = generateCsrfToken();

        setAuthCookies(res, token, csrf);
        sendSuccess(res, { id: userId, email, name, csrfToken: csrf });
    } catch (err: any) {
        sendError(res, err.message, 500);
    }
});

router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const user = await queries.get<{ id: number; password_hash: string; name: string }>(
            'SELECT id, password_hash, name FROM users WHERE email = ?', [email]
        );

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return sendError(res, 'Invalid email or password', 401);
        }

        await queries.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        const token = signToken(createTokenPayload(user.id, email));
        const csrf = generateCsrfToken();

        setAuthCookies(res, token, csrf);
        sendSuccess(res, { id: user.id, email, name: user.name, csrfToken: csrf });
    } catch (err: any) {
        sendError(res, err.message, 500);
    }
});

router.post('/logout', (_req: Request, res: Response) => {
    clearAuthCookies(res);
    sendSuccess(res, { loggedOut: true });
});

router.get('/me', async (req: Request, res: Response) => {
    try {
        const token = req.cookies?.token;
        if (!token) return sendError(res, 'Not authenticated', 401);

        const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as { userId: number; email: string };
        const user = await queries.get<{ id: number; email: string; name: string }>(
            'SELECT id, email, name FROM users WHERE id = ?', [decoded.userId]
        );

        if (!user) {
            clearAuthCookies(res);
            return sendError(res, 'User not found', 401);
        }

        sendSuccess(res, { id: user.id, email: user.email, name: user.name });
    } catch {
        clearAuthCookies(res);
        sendError(res, 'Invalid session', 401);
    }
});

export default router;
