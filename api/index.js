require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { rateLimit, securityHeaders, sanitizeError, validateSessionSecret } = require('../src/middleware/security');

const app = express();

// Security middleware
app.use(rateLimit);
app.use(securityHeaders);

// Body parsing
app.use(express.json({ limit: '10kb' }));

// Session configuration
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  secret: process.env.SESSION_SECRET || 'vercel-session-secret-replace-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict'
  },
  name: 'sessionId'
}));

// Database
const db = require('../src/db/database');

// Routes
app.use('/api/families', require('../src/routes/families'));
app.use('/api/families/:slug/members', require('../src/routes/members'));
app.use('/api/families/:slug/accounts', require('../src/routes/accounts'));
app.use('/api/families/:slug/debts', require('../src/routes/debts'));
app.use('/api/families/:slug/insurance', require('../src/routes/insurance'));
app.use('/api/families/:slug/goals', require('../src/routes/goals'));
app.use('/api/families/:slug/budget', require('../src/routes/budget'));
app.use('/api/families/:slug/actions', require('../src/routes/actions'));
app.use('/api/families/:slug/milestones', require('../src/routes/milestones'));
app.use('/api/families/:slug/summary', require('../src/routes/summary'));
app.use('/api/families/:slug/project', require('../src/routes/projections'));
app.use('/api/families/:slug/tax', require('../src/routes/tax'));
app.use('/api/families/:slug/tools', require('../src/routes/tools'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err);
  res.status(500).json({ success: false, error: sanitizeError(err) });
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

module.exports = app;