import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { CONFIG, generateCspNonce } from './config';
import { runMigrations } from './db/migrate';
import { errorHandler } from './middleware/errorHandler';
import { authenticateToken, optionalAuth, validateCsrf } from './middleware/auth';

import authRouter from './routes/auth';
import familiesRouter from './routes/families';
import summaryRouter from './routes/summary';
import projectionsRouter from './routes/projections';
import taxRouter from './routes/tax';
import toolsRouter from './routes/tools';
import scenariosRouter from './routes/scenarios';
import mfaRouter from './routes/mfa';
import importRouter from './routes/import';
import reportsRouter from './routes/reports';
import marketRouter from './routes/market';
import coachRouter from './routes/coach';
import { createCrudRouter } from './routes/crudRouter';

import { healthCheck } from './db/database';

const app = express();
let server: ReturnType<typeof app.listen> | null = null;

// Graceful shutdown
function gracefulShutdown(signal: string) {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    if (server) {
        server.close(async () => {
            console.log('HTTP server closed');
            try {
                // better-sqlite3 closeDb is synchronous, but keep async pattern
                const { closeDb } = await import('./db/database');
                closeDb();
                console.log('Database connection closed');
                process.exit(0);
            } catch (err) {
                console.error('Error closing database:', err);
                process.exit(1);
            }
        });
        // Force exit after 10s if hanging
        setTimeout(() => {
            console.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    } else {
        process.exit(0);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

// CSP nonce middleware — generates a unique nonce per request for inline scripts
app.use((req: Request, res: Response, next: NextFunction) => {
    res.locals.cspNonce = generateCspNonce();
    next();
});

// #11: Improved CSP — nonce-based, no unsafe-inline/eval
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'",
                (req: any) => `'nonce-${req.res?.locals?.cspNonce || ''}'`,
                "https://cdn.jsdelivr.net", // Alpine.js + Chart.js CDN fallback
            ],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // CSS-in-JS requires unsafe-inline
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [], // #24: HTTPS in production
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// #6: CORS — always use a proper origin, never false with credentials
app.use(cors({
    origin: CONFIG.CORS_ORIGIN,
    credentials: true,
}));

app.use(compression());
app.use(morgan('dev'));
app.use(cookieParser());

// #19: Reduced JSON body limit from 10mb to 1mb
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Path resolution for static files
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// #5: Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: CONFIG.AUTH_RATE_LIMIT_MAX, // 10 attempts per window per IP
    message: { success: false, error: 'Too many authentication attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// General API rate limit
const apiLimiter = rateLimit({
    windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
    max: CONFIG.RATE_LIMIT_MAX,
    message: { success: false, error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/health',
});

app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// Auth routes (public, but rate-limited)
app.use('/api/auth', authRouter);
app.use('/api/auth/mfa', mfaRouter);
app.use('/api/families/:slug/import', importRouter);

// All family routes require authentication
app.use('/api/families', authenticateToken, familiesRouter);

// #24: Redirect HTTP to HTTPS in production
if (CONFIG.NODE_ENV === 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.headers['x-forwarded-proto'] === 'http') {
            return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
        }
        next();
    });
}

// CSRF protection for state-changing methods
const csrfProtectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/') && csrfProtectedMethods.includes(req.method)) {
        return validateCsrf(req, res, next);
    }
    next();
});

app.use('/api/families/:slug/members', createCrudRouter({
    table: 'members', columns: ['name', 'role', 'age', 'notes'], requiredColumns: ['name'],
}));

app.use('/api/families/:slug/accounts', createCrudRouter({
    table: 'accounts', columns: ['type', 'institution', 'balance', 'contribution_room', 'target_allocation', 'notes'], requiredColumns: ['type'],
}));

app.use('/api/families/:slug/debts', createCrudRouter({
    table: 'debts', columns: ['type', 'balance', 'interest_rate', 'monthly_payment', 'original_amount', 'start_date', 'notes'], requiredColumns: ['type'],
}));

app.use('/api/families/:slug/insurance', createCrudRouter({
    table: 'insurance', columns: ['type', 'provider', 'coverage', 'premium', 'status', 'renewal_date', 'notes'], requiredColumns: ['type'],
}));

app.use('/api/families/:slug/goals', createCrudRouter({
    table: 'goals', columns: ['timeframe', 'priority', 'description', 'target_amount', 'current_amount', 'monthly_contribution', 'deadline', 'status', 'project_return', 'notes'],
}));

app.use('/api/families/:slug/budget', createCrudRouter({
    table: 'budget_entries', columns: ['month_year', 'category', 'subcategory', 'amount', 'type', 'notes'], allowedFilters: ['month_year', 'type'],
}));

app.use('/api/families/:slug/actions', createCrudRouter({
    table: 'action_items', columns: ['phase', 'description', 'status', 'due_date', 'completed_at', 'notes'],
}));

app.use('/api/families/:slug/milestones', createCrudRouter({
    table: 'milestones', columns: ['name', 'target_date', 'status', 'celebration_plan'], requiredColumns: ['name'],
}));

app.use('/api/families/:slug/recurring', createCrudRouter({
    table: 'recurring_items', columns: ['name', 'category', 'subcategory', 'amount', 'type', 'frequency', 'start_date', 'end_date', 'active'],
}));

app.use('/api/families/:slug/summary', summaryRouter);
app.use('/api/families/:slug/project', projectionsRouter);
app.use('/api/families/:slug/tax', taxRouter);
app.use('/api/families/:slug/tools', toolsRouter);
app.use('/api/families/:slug/scenarios', scenariosRouter);
app.use('/api/families/:slug/reports', reportsRouter);
app.use('/api/families/:slug/market', marketRouter);
app.use('/api/families/:slug/coach', coachRouter);

app.get('/api/health', (_req: Request, res: Response) => {
    const dbHealthy = healthCheck();
    const status = dbHealthy ? 'healthy' : 'degraded';
    const code = dbHealthy ? 200 : 503;
    res.status(code).json({
        success: dbHealthy,
        data: { status, version: '2.0.0', timestamp: new Date().toISOString(), database: dbHealthy ? 'connected' : 'unreachable' }
    });
});

app.get('*', optionalAuth, (req: Request, res: Response) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found' });
    }
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const html = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8');
    const rendered = html.replace(/{{CSP_NONCE}}/g, res.locals.cspNonce);
    res.send(rendered);
});

app.use(errorHandler);

if (require.main === module) {
    runMigrations();
    server = app.listen(CONFIG.PORT, () => {
        console.log(`🏠 Family Financial Planner v2.0 running at http://localhost:${CONFIG.PORT}`);
        console.log(`📊 API Health: http://localhost:${CONFIG.PORT}/api/health`);
        console.log(`🌍 Environment: ${CONFIG.NODE_ENV}`);
    });
}

export default app;