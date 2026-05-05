import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { CONFIG } from './config';
import { runMigrations } from './db/migrate';
import { errorHandler } from './middleware/errorHandler';
import { authenticateToken, optionalAuth, validateCsrf } from './middleware/auth';

import authRouter from './routes/auth';
import familiesRouter from './routes/families';
import summaryRouter from './routes/summary';
import projectionsRouter from './routes/projections';
import taxRouter from './routes/tax';
import toolsRouter from './routes/tools';
import { createCrudRouter } from './routes/crudRouter';

const app = express();

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameAncestors: ["'self'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false, // Allow CDN scripts
}));

app.use(cors({
    origin: CONFIG.CORS_ORIGIN || false,
    credentials: true,
}));

app.use(compression());
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Path resolution for static files - handling both src and dist
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Rate limiting - only API routes, not static assets
const limiter = rateLimit({
    windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
    max: CONFIG.RATE_LIMIT_MAX,
    message: { success: false, error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !req.path.startsWith('/api/'),
});
app.use('/api/', limiter);

// Auth routes (public)
app.use('/api/auth', authRouter);

// All routes below require authentication
app.use('/api/families', familiesRouter);

// CSRF protection for state-changing methods on all CRUD and business routes
const csrfProtectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/') && csrfProtectedMethods.includes(req.method)) {
        return validateCsrf(req, res, next);
    }
    next();
});

app.use('/api/families/:slug/members', authenticateToken, createCrudRouter({
    table: 'members', columns: ['name', 'role', 'age', 'notes'], requiredColumns: ['name'],
}));

app.use('/api/families/:slug/accounts', authenticateToken, createCrudRouter({
    table: 'accounts', columns: ['type', 'institution', 'balance', 'contribution_room', 'target_allocation', 'notes'], requiredColumns: ['type'],
}));

app.use('/api/families/:slug/debts', authenticateToken, createCrudRouter({
    table: 'debts', columns: ['type', 'balance', 'interest_rate', 'monthly_payment', 'original_amount', 'start_date', 'notes'], requiredColumns: ['type'],
}));

app.use('/api/families/:slug/insurance', authenticateToken, createCrudRouter({
    table: 'insurance', columns: ['type', 'provider', 'coverage', 'premium', 'status', 'renewal_date', 'notes'], requiredColumns: ['type'],
}));

app.use('/api/families/:slug/goals', authenticateToken, createCrudRouter({
    table: 'goals', columns: ['timeframe', 'priority', 'description', 'target_amount', 'current_amount', 'monthly_contribution', 'deadline', 'status', 'project_return', 'notes'],
}));

app.use('/api/families/:slug/budget', authenticateToken, createCrudRouter({
    table: 'budget_entries', columns: ['month_year', 'category', 'subcategory', 'amount', 'type', 'notes'], allowedFilters: ['month_year', 'type'],
}));

app.use('/api/families/:slug/actions', authenticateToken, createCrudRouter({
    table: 'action_items', columns: ['phase', 'description', 'status', 'due_date', 'completed_at', 'notes'],
}));

app.use('/api/families/:slug/milestones', authenticateToken, createCrudRouter({
    table: 'milestones', columns: ['name', 'target_date', 'status', 'celebration_plan'], requiredColumns: ['name'],
}));

app.use('/api/families/:slug/recurring', authenticateToken, createCrudRouter({
    table: 'recurring_items', columns: ['name', 'category', 'subcategory', 'amount', 'type', 'frequency', 'start_date', 'end_date', 'active'],
}));

app.use('/api/families/:slug/summary', authenticateToken, summaryRouter);
app.use('/api/families/:slug/project', authenticateToken, projectionsRouter);
app.use('/api/families/:slug/tax', authenticateToken, taxRouter);
app.use('/api/families/:slug/tools', authenticateToken, toolsRouter);

app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ success: true, data: { status: 'healthy', version: '2.0.0', timestamp: new Date().toISOString() } });
});

app.get('*', optionalAuth, (req: Request, res: Response) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found' });
    }
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.use(errorHandler);

if (require.main === module) {
    runMigrations().then(() => {
        app.listen(CONFIG.PORT, () => {
            console.log(`🏠 Family Financial Planner v2.0 running at http://localhost:${CONFIG.PORT}`);
            console.log(`📊 API: http://localhost:${CONFIG.PORT}/api/health`);
        });
    }).catch((err) => {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    });
}

export default app;
