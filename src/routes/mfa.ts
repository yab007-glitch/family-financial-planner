import { Router, Request, Response } from 'express';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import QRCode from 'qrcode';
import { z } from 'zod';
import queries from '../db/queries';
import { authenticateToken } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';
import { validateBody } from '../middleware/validator';

const router = Router();
router.use(authenticateToken);

const totp = new TOTP({
    crypto: new NobleCryptoPlugin(),
    base32: new ScureBase32Plugin(),
    issuer: 'WealthBuilder'
});

const verifySchema = z.object({
    token: z.string().length(6),
});

router.post('/setup', async (req: Request, res: Response) => {
    try {
        const user = await queries.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [req.userId]);
        if (!user) return sendError(res, 'User not found', 404);

        const secret = totp.generateSecret();
        const otpauth = totp.toURI({ secret, label: user.email });
        const qrCodeUrl = await QRCode.toDataURL(otpauth);

        await queries.run('UPDATE users SET two_factor_secret = ? WHERE id = ?', [secret, req.userId]);

        sendSuccess(res, { qrCodeUrl, secret });
    } catch (err) {
        console.error('MFA setup error:', err);
        sendError(res, 'Failed to setup MFA', 500);
    }
});

router.post('/verify', validateBody(verifySchema), async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        const user = await queries.get<{ two_factor_secret: string }>('SELECT two_factor_secret FROM users WHERE id = ?', [req.userId]);
        if (!user?.two_factor_secret) return sendError(res, 'MFA not set up', 400);

        const isValid = await totp.verify(token, { secret: user.two_factor_secret });
        if (!isValid) return sendError(res, 'Invalid MFA token', 401);

        sendSuccess(res, { verified: true });
    } catch (err) {
        console.error('MFA verify error:', err);
        sendError(res, 'Verification failed', 500);
    }
});

export default router;
