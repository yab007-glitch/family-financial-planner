# 🏠 WealthBuilder — Family Financial Planner

A self-hosted micro SaaS for Canadian family financial planning. Built with **Node.js, Express, TypeScript, SQLite**, and a **wizard-driven vanilla JS frontend** powered by Alpine.js.

## ✨ What Makes It Different

- **Wizard-Driven Onboarding** — No financial jargon. Just answer simple questions and get a personalized wealth plan.
- **Unified Dashboard** — Everything in one view: net worth, goals progress, next best action, cash flow, accounts & debts.
- **Canadian Tax-Aware** — Marginal rate calculations, RRSP/TFSA/FHSA optimization, Quebec-specific credits.
- **Production-Grade Security** — httpOnly cookies, CSRF tokens, rate limiting, Helmet CSP, input validation.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and set a secret
cp .env.example .env
# Edit .env: set JWT_SECRET to a strong random string

# 3. Initialize database (creates planner.db)
npm run migrate

# 4. Build TypeScript
npm run build

# 5. Start the server
npm start
```

The app will be available at: **http://localhost:4000**

## 🚂 Deploy on Railway (Recommended)

Railway provides free hosting with automatic deploys from GitHub.

### 1. Fork / push to GitHub
Ensure your repo is at `github.com/yab007-glitch/family-financial-planner` (or your own fork).

### 2. Create Railway project
```bash
# In the project directory
railway login      # Already done? Skip.
railway init       # Create new project
railway up         # First deploy
```

### 3. Configure Environment Variables
In the Railway dashboard (or CLI), set:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | ✅ |
| `JWT_SECRET` | Strong random string (≥32 chars) | ✅ |
| `DB_PATH` | `/app/data/planner.db` | ✅ |
| `COOKIE_SECURE` | `true` | ✅ |
| `CORS_ORIGIN` | `https://your-railway-domain.up.railway.app` | Optional |

Generate a secure JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 4. Add Persistent Volume (Critical for SQLite)
SQLite needs a persistent volume or data will be lost on every deploy.

1. Go to your Railway project dashboard
2. Click your service → **Volumes** tab
3. **Add Volume**
   - Mount Path: `/app/data`
   - Size: 1 GB (or more)
4. Redeploy: `railway up`

The app will automatically create `planner.db` inside `/app/data` on first migration.

### 5. Verify Deploy
```bash
curl https://your-railway-domain.up.railway.app/api/health
```
Expected: `{"success":true,"data":{"status":"healthy",...}}`

### 🔄 Auto-Deploy
Railway auto-deploys on every `git push` to `main`. No manual steps needed.

## 🧪 Run the Quality Gate

```bash
npm run ci          # TypeScript + Lint + Tests
```

| Check | Status |
|-------|--------|
| TypeScript Compilation | ✅ `tsc --noEmit` |
| ESLint | ✅ 0 errors |
| Unit + Integration Tests | ✅ 22 tests |

## 🏗️ Architecture

### Backend (`src/`)

| Layer | Files |
|-------|-------|
| Entry | `server.ts` — Express app, security headers, rate limiting |
| Config | `config.ts` — Environment-aware settings |
| Database | `db/database.ts`, `db/queries.ts`, `db/schema.sql`, `db/migrate.ts` |
| Auth | `middleware/auth.ts` — httpOnly JWT cookies + CSRF |
| Routes | `routes/auth.ts`, `routes/families.ts`, `routes/crudRouter.ts`, `routes/tax.ts`, `routes/tools.ts`, `routes/summary.ts`, `routes/projections.ts` |
| Services | `services/taxEngine.ts`, `services/debtPlanner.ts`, `services/goalPlanner.ts`, `services/retirementSimulator.ts` |
| Utils | `utils/*.ts` — Mortgage, Monte Carlo, FHSA, report generators |

### Frontend (`public/`)

| File | Purpose |
|------|---------|
| `index.html` | Single SPA shell with inline wizard + dashboard |
| `css/styles.css` | Dark/light theme, wizard cards, dashboard grid |
| `js/api.js` | Cookie-based fetch client with CSRF headers |
| `js/app.js` | Alpine.js controller: auth, wizard (5 steps), dashboard, tools |
| `js/router.js` | Minimal hash router |

### Wizard Flow

1. **Welcome** — Value proposition cards
2. **Household** — Family name, province, members & roles
3. **Money Snapshot** — Accounts you own, debts you owe
4. **Goals** — Pick from templates (Emergency Fund, Home, Retirement, Kids, Debt-free)
5. **Your Plan** — Auto-generated net worth, debt-free date, next best account, 30-day action list

### Dashboard Cards

- **Net Worth** — Assets vs liabilities with visual bar chart
- **Next Best Action** — Prioritized recommendation card
- **Goals Progress** — Progress bars toward each target
- **Monthly Cash Flow** — Income vs expenses bar chart
- **Accounts & Debts** — Quick-add tables

## 🔒 Security Hardening

| Feature | Implementation |
|---------|----------------|
| Auth Transport | httpOnly `token` cookie + `csrf_token` cookie |
| CSRF Protection | Double-submit cookie on all state-changing requests |
| Rate Limiting | 100 req / 15 min per IP on `/api/*` |
| Headers | Helmet CSP, HSTS, X-Frame-Options, referrer policy |
| Input Validation | Zod schemas on all POST/PUT bodies |
| Password Hashing | `bcrypt` with configurable rounds |
| SQL Injection | Parameterized queries + table/column whitelisting |

## 📦 Database Schema

Key tables: `users`, `families`, `members`, `accounts`, `debts`, `insurance`, `goals`, `budget_entries`, `action_items`, `milestones`, `recurring_items`, `audit_logs`, `net_worth_snapshots`.

Run migrations:
```bash
npm run migrate
```

## 📝 Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login (sets cookies) |
| POST | `/api/auth/logout` | Clear cookies |
| GET | `/api/auth/me` | Verify session |
| GET | `/api/families` | List user's families |
| POST | `/api/families` | Create family |
| GET | `/api/families/:slug` | Full family profile |
| GET/POST/PUT/DELETE | `/api/families/:slug/members` | CRUD |
| GET/POST/PUT/DELETE | `/api/families/:slug/accounts` | CRUD |
| GET/POST/PUT/DELETE | `/api/families/:slug/debts` | CRUD |
| GET/POST/PUT/DELETE | `/api/families/:slug/goals` | CRUD |
| GET | `/api/families/:slug/summary` | Net worth + savings rate |
| POST | `/api/families/:slug/tax/calculate` | Tax breakdown |
| POST | `/api/families/:slug/tax/strategy` | Optimal savings order |
| POST | `/api/families/:slug/tools/*` | Mortgage, retirement, Monte Carlo, FHSA, debt strategy |

## 🖨️ PDF Export

Click the **"Export PDF"** button in the sidebar to generate a print-ready financial report. Uses browser print with `@media print` CSS.

## 🧪 Testing

```bash
# Full test suite
npm run test:run

# API smoke test
curl http://localhost:4000/api/health
```

## 🏡 Seed Data

The seed script (`scripts/seed-bheekun.js`) pre-populates the database with sample Canadian family data for demo purposes.

```bash
node scripts/seed-bheekun.js
```

---

Built for production. Run `npm run ci` before every deploy.
