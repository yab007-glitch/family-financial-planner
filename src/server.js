require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { rateLimit, securityHeaders, sanitizeError, validateSessionSecret } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Validate session secret before starting
validateSessionSecret();

// Security middleware
app.use(rateLimit);
app.use(securityHeaders);

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  secret: process.env.SESSION_SECRET || (() => {
    throw new Error('SESSION_SECRET must be set in .env file');
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict'
  },
  name: 'sessionId' // Don't use default 'connect.sid'
}));

// Database
const db = require('./db/database');

// Routes
app.use('/api/families', require('./routes/families'));
app.use('/api/families/:slug/members', require('./routes/members'));
app.use('/api/families/:slug/accounts', require('./routes/accounts'));
app.use('/api/families/:slug/debts', require('./routes/debts'));
app.use('/api/families/:slug/insurance', require('./routes/insurance'));
app.use('/api/families/:slug/goals', require('./routes/goals'));
app.use('/api/families/:slug/budget', require('./routes/budget'));
app.use('/api/families/:slug/actions', require('./routes/actions'));
app.use('/api/families/:slug/milestones', require('./routes/milestones'));
app.use('/api/families/:slug/summary', require('./routes/summary'));
app.use('/api/families/:slug/project', require('./routes/projections'));
app.use('/api/families/:slug/tax', require('./routes/tax'));
app.use('/api/families/:slug/tools', require('./routes/tools'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler - sanitized for security
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err);

  // Log request details for debugging (not sent to client)
  console.error(`Request: ${req.method} ${req.path}`);
  console.error(`IP: ${req.ip || req.connection.remoteAddress}`);

  res.status(500).json({
    success: false,
    error: sanitizeError(err)
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// Serve SPA - ONLY for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🏠 Family Financial Planner running at http://localhost:${PORT}`);
  console.log(`📊 Open: http://localhost:${PORT}/#/bheekun/dashboard`);
  console.log(`💚 Health: http://localhost:${PORT}/health`);
  if (!isProduction) {
    console.log('⚠️  Running in development mode. Set NODE_ENV=production for production.');
  }
});
