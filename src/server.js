require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
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
app.use('/api/families/:slug/tax', require('./routes/tax'));
app.use('/api/families/:slug/tools', require('./routes/tools'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// Serve SPA - ONLY for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🏠 Family Financial Planner running at http://localhost:${PORT}`);
  console.log(`📊 Open: http://localhost:${PORT}/#/bheekun/dashboard`);
});
