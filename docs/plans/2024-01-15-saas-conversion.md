# Family Financial Planner SaaS Implementation Plan

> **Goal:** Convert the existing Notion-based Family Financial Planner into a self-hosted micro SaaS using Node.js, Express, SQLite, and vanilla HTML/JS.

**Architecture:** Single Express server serves a REST API and static frontend. SQLite database stores family profiles, financial data, budgets, goals, insurance decisions, and action plans. All financial calculations (projections, net worth, tax estimates) run server-side to ensure consistency.

**Tech Stack:** Node.js, Express, SQLite3 (better-sqlite3), bcryptjs, express-session, vanilla HTML/CSS/JS frontend.

---

## Task 1: Scaffold Node.js Project

**Files:**
- Create: `package.json`
- Create: `src/server.js`
- Create: `public/index.html`
- Create: `public/css/styles.css`
- Create: `public/js/app.js`
- Create: `.env.example`
- Create: `README.md` (SaaS version)

**Step 1: Create package.json**

```json
{
  "name": "family-financial-planner",
  "version": "1.0.0",
  "description": "Micro SaaS for family financial planning",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "migrate": "node src/db/migrate.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.4.3",
    "bcryptjs": "^2.4.3",
    "express-session": "^1.17.3",
    "dotenv": "^16.4.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.3"
  }
}
```

**Step 2: Create base server.js**

```javascript
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Routes will be added here in later tasks

app.listen(PORT, () => {
  console.log(`🏠 Family Financial Planner running at http://localhost:${PORT}`);
});
```

**Step 3: Create placeholder public files**

Minimal HTML, CSS, JS scaffolding (will be filled in Task 5).

**Step 4: Install dependencies**

Run: `npm install`
Expected: node_modules created, no errors.

**Step 5: Commit**

```bash
git add package.json src/server.js public/ .env.example README.md
git commit -m "feat: scaffold project structure"
```

---

## Task 2: Create SQLite Schema & Database Init

**Files:**
- Create: `src/db/database.js`
- Create: `src/db/migrate.js`
- Create: `src/db/schema.sql`

**Step 1: Write schema.sql**

Tables needed:
- `families` (id, name, slug, created_at)
- `members` (id, family_id, name, role, age, notes)
- `accounts` (id, family_id, type, institution, balance, contribution_room, notes)
- `debts` (id, family_id, type, balance, interest_rate, monthly_payment, notes)
- `insurance` (id, family_id, type, provider, coverage, premium, status, notes)
- `goals` (id, family_id, timeframe, priority, description, target_amount, deadline, status)
- `budget_entries` (id, family_id, month_year, category, subcategory, amount, type [income/expense])
- `insurance_decisions` (id, family_id, provider, policy_type, coverage, premium, decision, rationale_text, reviewed_at)
- `action_items` (id, family_id, phase, description, status, due_date, notes)
- `milestones` (id, family_id, name, target_date, status, celebration_plan)

**Step 2: Create database.js**

Singleton pattern to open better-sqlite3 connection, wrapped in try/catch, with WAL mode enabled for performance.

**Step 3: Create migrate.js**

Reads schema.sql and executes it. Logs success/failure.

Run: `node src/db/migrate.js`
Expected: `planner.db` created, all tables present.

**Step 4: Commit**

```bash
git add src/db/
git commit -m "feat: add SQLite schema and migrations"
```

---

## Task 3: Build Express API Routes

**Files:**
- Create: `src/routes/families.js`
- Create: `src/routes/members.js`
- Create: `src/routes/finances.js`
- Create: `src/routes/budget.js`
- Create: `src/routes/goals.js`
- Create: `src/routes/insurance.js`
- Create: `src/routes/actions.js`
- Create: `src/routes/milestones.js`
- Create: `src/routes/calculations.js`
- Modify: `src/server.js` (mount routes)

**Step 1: Create utility response wrapper**

Create `src/utils/response.js` — standard `{ success, data, error }` JSON wrapper.

**Step 2: families.js**

Endpoints:
- GET `/api/families` — list all
- POST `/api/families` — create (name, slug)
- GET `/api/families/:slug` — get single with all nested data
- PUT `/api/families/:slug` — update
- DELETE `/api/families/:slug` — delete

**Step 3: members.js, finances.js, budget.js, goals.js, insurance.js, actions.js, milestones.js**

Standard CRUD for each table, scoped by `family_id` (looked up via slug param).

**Step 4: calculations.js**

Two endpoints:
- POST `/api/families/:slug/calculate/net-worth` — compute total assets minus total debts
- POST `/api/families/:slug/calculate/projections` — accept `{ initial_amount, monthly_contribution, years, rate }`, return year-by-year projection array using compound interest formula.

**Step 5: Wire everything in server.js**

```javascript
app.use('/api/families', require('./routes/families'));
app.use('/api/families/:slug/members', require('./routes/members'));
// ... etc
```

Note: Use `req.params.slug` in each route file to get family context.

**Step 6: Quick API test**

Run: `npm start` then `curl -X POST http://localhost:3000/api/families -H "Content-Type: application/json" -d '{"name":"Bheekun Family","slug":"bheekun"}'`
Expected: `{"success":true,"data":{"id":1,"name":"Bheekun Family","slug":"bheekun"}}`

**Step 7: Commit**

```bash
git add src/routes/ src/utils/ src/server.js
git commit -m "feat: add full REST API for family financial planning"
```

---

## Task 4: Build Vanilla HTML/JS Frontend Pages

**Files:**
- Modify: `public/index.html` — main layout with nav sidebar
- Modify: `public/css/styles.css` — clean, Notion-inspired minimal design
- Modify: `public/js/app.js` — router + API client
- Create: `public/pages/dashboard.html` (template, loaded by JS)
- Create: `public/pages/family.html`
- Create: `public/pages/finances.html`
- Create: `public/pages/budget.html`
- Create: `public/pages/goals.html`
- Create: `public/pages/insurance.html`
- Create: `public/pages/actions.html`
- Create: `public/js/api.js`
- Create: `public/js/router.js`

**Step 1: Create api.js**

Thin wrapper around `fetch()` for all API calls. Returns promises.

```javascript
const API = {
  get: (path) => fetch(path).then(r => r.json()),
  post: (path, body) => fetch(path, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)}).then(r => r.json()),
  // ... put, delete
};
```

**Step 2: Create router.js**

Hash-based routing: `#/bheekun/dashboard`, `#/bheekun/family`, etc.
- Reads hash
- Fetches HTML template from `public/pages/`
- Injects into main container
- Calls page-specific init function (e.g., `initDashboard(familySlug)`)

**Step 3: Design CSS**

- Sidebar nav (collapsible on mobile)
- Card-based layout
- Tables for financial data (editable inline)
- Status badges (colored: green active, red gap, yellow pending)
- Responsive grid for dashboard widgets

**Step 4: Build Dashboard page**

Widgets:
- Family name & last updated
- Net worth card (green if positive)
- Savings rate progress bar
- Next 3 upcoming action items
- Current month's budget summary (income vs expenses)
- Quick links to other sections

**Step 5: Build Family page**

- Table of family members (add/edit/delete)
- Basic family details form (location, tax situation)

**Step 6: Build Finances page**

- Tabs: Assets | Liabilities | Insurance
- Each tab has editable tables
- Net worth calculation displayed at top (auto-updates on change)
- "Add Account" / "Add Debt" / "Add Insurance" buttons with modal forms

**Step 7: Build Budget page**

- Month selector dropdown
- Two-column layout: Income (left) | Expenses (right)
- Each category is a collapsible section
- Inline editing of amounts
- Bottom bar: Total Income | Total Expenses | Net Cash Flow | Savings Rate %
- Color coding: green surplus, red deficit

**Step 8: Build Goals page**

- Three columns: Short-term | Medium-term | Long-term
- Each goal is a card with: description, target amount, progress bar (current/amount), deadline, status badge
- Drag-and-drop to reorder priorities (or simple up/down arrows)

**Step 9: Build Insurance & Actions pages**

- Insurance decision log (table with rationale)
- Action plan checklist with checkboxes (updates status to done)
- Milestones timeline view

**Step 10: Commit**

```bash
git add public/
git commit -m "feat: build complete vanilla JS frontend"
```

---

## Task 5: Add Investment Projection Math & Net Worth Calculations

**Files:**
- Create: `src/utils/calculations.js`
- Modify: `public/js/pages/finances.js` (or inline in app.js)
- Modify: `public/js/pages/dashboard.js`

**Step 1: Write calculations.js**

```javascript
function compoundInterestProjection(principal, monthlyContribution, annualRate, years) {
  const monthlyRate = annualRate / 12 / 100;
  const months = years * 12;
  let balance = principal;
  const schedule = [];
  
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    if (m % 12 === 0) {
      schedule.push({
        year: m / 12,
        age: null, // filled by caller
        balance: Math.round(balance),
        totalContributed: principal + (monthlyContribution * m)
      });
    }
  }
  return schedule;
}

function calculateNetWorth(familySlug, db) {
  const assets = db.prepare('SELECT COALESCE(SUM(balance),0) as total FROM accounts WHERE family_id = (SELECT id FROM families WHERE slug = ?)').get(familySlug).total;
  const liabilities = db.prepare('SELECT COALESCE(SUM(balance),0) as total FROM debts WHERE family_id = (SELECT id FROM families WHERE slug = ?)').get(familySlug).total;
  return { assets, liabilities, netWorth: assets - liabilities };
}

function calculateTaxRefund(rrspContribution, marginalRate) {
  return Math.round(rrspContribution * (marginalRate / 100));
}

module.exports = { compoundInterestProjection, calculateNetWorth, calculateTaxRefund };
```

**Step 2: Integrate into API routes**

- GET `/api/families/:slug/summary` returns net worth + asset breakdown + liability breakdown
- POST `/api/families/:slug/project` accepts form params, returns projection array

**Step 3: Frontend integration**

- Finances page shows live net worth in header
- Goals page shows "Projected Value" for retirement goals using the API
- Dashboard shows small chart (CSS bar chart or simple canvas) of net worth over time if historical data exists

**Step 4: Commit**

```bash
git add src/utils/calculations.js src/routes/calculations.js public/js/pages/
git commit -m "feat: add financial math engine (projections, net worth, tax)"
```

---

## Task 6: Add PDF Export & Polish

**Files:**
- Create: `src/utils/pdf-generator.js`
- Modify: `public/index.html` — add "Export PDF" button
- Modify: `public/js/app.js` — download handler

**Step 1: PDF Generator logic**

For micro SaaS simplicity, avoid heavy Puppeteer. Instead:
- Frontend generates a clean print stylesheet (`@media print`)
- "Export PDF" button triggers `window.print()`
- CSS hides nav, buttons, and shows full-page financial report layout

CSS `@media print` rules:
- Hide sidebar, buttons, forms
- Show all sections in long-scroll layout
- Add page breaks between major sections
- Display "Generated on [date]" footer

**Step 2: Add print styles to CSS**

```css
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  body { font-size: 12pt; color: #000; background: #fff; }
  .card { border: 1px solid #ccc; box-shadow: none; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
}
```

**Step 3: Add "Download PDF" button**

Top-right of every page, calls `window.print()`.

**Step 4: Polish checklist**

- [ ] Add loading spinners for API calls
- [ ] Add empty state illustrations/zero data states
- [ ] Auto-save budget entries (debounced on change)
- [ ] Add confirmation dialogs for destructive actions
- [ ] Responsive mobile view (stack tables, hide less critical columns)
- [ ] Add `src/middleware/error-handler.js` for consistent 500 responses

**Step 5: Commit**

```bash
git add src/utils/pdf-generator.js public/css/styles.css public/js/app.js
git commit -m "feat: add PDF export via print stylesheet and UI polish"
```

---

## Task 7: Final Integration & Verification

**Files:**
- Modify: `package.json` — add `start` script validation
- Create: `scripts/seed-bheekun.js` — seed the Bheekun family data from README
- Modify: `README.md` — add setup instructions

**Step 1: Create seed script**

Inserts:
- Family: Bheekun, slug `bheekun`
- Members: Yasser (38, Primary Income), Wife (TBD), Kids (TBD)
- Accounts: TFSA ($0), RRSP ($0), Emergency Fund ($0)
- Debts: Mortgage, Car Loan, Credit Cards (all $0 balance as placeholders)
- Insurance: Mortgage Life (active), Term Life (gap), Critical Illness (gap), Disability (check)
- Goals: Emergency Fund $10K, TFSA $15K, RRSP $10K, etc.
- Insurance Decision: iA policy declined with full rationale
- Action Items: Week 1, Week 2, Month 1 tasks
- Milestones: Emergency Fund $10K, TFSA maxed, etc.

Run: `node scripts/seed-bheekun.js`
Expected: All data populated, verify via API.

**Step 2: Update README.md**

Add:
- Prerequisites: Node.js 18+
- Install: `npm install`
- Migrate: `npm run migrate`
- Seed: `node scripts/seed-bheekun.js`
- Run: `npm start`
- Open: `http://localhost:3000/#/bheekun/dashboard`

**Step 3: Final manual test walkthrough**

1. Start server: `npm start`
2. Open `http://localhost:3000/#/bheekun/dashboard`
3. Verify net worth shows $0 (all accounts at $0)
4. Go to Budget, add an income entry, verify totals update
5. Go to Goals, verify retirement projections show computed values
6. Click "Export PDF", verify print preview shows clean report
7. Go to Finances, add a TFSA account with $5,000 balance, verify net worth updates
8. Go to Actions, check off "Register for CRA My Account", verify status updates

**Step 4: Commit**

```bash
git add scripts/seed-bheekun.js README.md package.json
git commit -m "feat: seed data and finalize SaaS setup"
```

**Step 5: Tag release**

```bash
git tag -a v1.0.0 -m "Initial SaaS release"
```

---

## Appendix: Database Schema Detail

### families
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| name | TEXT | NOT NULL |
| slug | TEXT | UNIQUE, NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### members
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| family_id | INTEGER | FK → families(id) |
| name | TEXT | NOT NULL |
| role | TEXT | e.g. 'Primary Income', 'Secondary Income', 'Dependent' |
| age | INTEGER | NULLable |
| notes | TEXT | |

### accounts
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| family_id | INTEGER | FK |
| type | TEXT | TFSA, RRSP, Emergency Fund, Checking, Savings |
| institution | TEXT | |
| balance | REAL | DEFAULT 0 |
| contribution_room | TEXT | e.g. "$0 / $78,000" |
| notes | TEXT | |

### debts
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| family_id | INTEGER | FK |
| type | TEXT | Mortgage, Car Loan, Credit Cards, Other |
| balance | REAL | DEFAULT 0 |
| interest_rate | REAL | NULLable |
| monthly_payment | REAL | NULLable |
| notes | TEXT | |

### goals
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| family_id | INTEGER | FK |
| timeframe | TEXT | Short-Term, Medium-Term, Long-Term |
| priority | INTEGER | 1, 2, 3... |
| description | TEXT | |
| target_amount | REAL | |
| deadline | DATE | NULLable |
| current_amount | REAL | DEFAULT 0 |
| status | TEXT | Not Started, In Progress, Completed, On Hold |

### action_items
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| family_id | INTEGER | FK |
| phase | TEXT | e.g. "Week 1: Foundation" |
| description | TEXT | |
| status | TEXT | Pending, In Progress, Done |
| due_date | DATE | NULLable |
| notes | TEXT | |

### budget_entries
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| family_id | INTEGER | FK |
| month_year | TEXT | YYYY-MM |
| category | TEXT | Housing, Utilities, Transportation, Food, Family, Debt, Insurance, Savings, Other |
| subcategory | TEXT | e.g. "Mortgage/Rent", "Groceries" |
| amount | REAL | DEFAULT 0 |
| type | TEXT | income OR expense |
| notes | TEXT | |

---

## Appendix: API Contract Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/families | List families |
| POST | /api/families | Create family |
| GET | /api/families/:slug | Get full family profile |
| PUT | /api/families/:slug | Update family |
| DELETE | /api/families/:slug | Delete family |
| GET | /api/families/:slug/members | List members |
| POST | /api/families/:slug/members | Add member |
| PUT | /api/families/:slug/members/:id | Update member |
| DELETE | /api/families/:slug/members/:id | Remove member |
| GET | /api/families/:slug/accounts | List accounts |
| POST | /api/families/:slug/accounts | Add account |
| PUT | /api/families/:slug/accounts/:id | Update account |
| DELETE | /api/families/:slug/accounts/:id | Remove account |
| GET | /api/families/:slug/debts | List debts |
| POST | /api/families/:slug/debts | Add debt |
| PUT | /api/families/:slug/debts/:id | Update debt |
| DELETE | /api/families/:slug/debts/:id | Remove debt |
| GET | /api/families/:slug/insurance | List insurance |
| POST | /api/families/:slug/insurance | Add insurance |
| PUT | /api/families/:slug/insurance/:id | Update insurance |
| DELETE | /api/families/:slug/insurance/:id | Remove insurance |
| GET | /api/families/:slug/goals | List goals |
| POST | /api/families/:slug/goals | Add goal |
| PUT | /api/families/:slug/goals/:id | Update goal |
| DELETE | /api/families/:slug/goals/:id | Remove goal |
| GET | /api/families/:slug/budget?month=YYYY-MM | Get budget |
| POST | /api/families/:slug/budget | Add budget entry |
| PUT | /api/families/:slug/budget/:id | Update entry |
| DELETE | /api/families/:slug/budget/:id | Remove entry |
| GET | /api/families/:slug/actions | List action items |
| POST | /api/families/:slug/actions | Add action |
| PUT | /api/families/:slug/actions/:id | Update action |
| GET | /api/families/:slug/milestones | List milestones |
| POST | /api/families/:slug/milestones | Add milestone |
| PUT | /api/families/:slug/milestones/:id | Update milestone |
| GET | /api/families/:slug/summary | Net worth + overview |
| POST | /api/families/:slug/project | Investment projections |

---

## Execution Notes

- All routes assume family existence — add middleware to validate `:slug` and 404 if missing.
- Use `better-sqlite3` prepared statements for all DB calls to prevent injection.
- Keep frontend vanilla JS (no build step) to minimize complexity.
- Use `localStorage` to cache family slug so refresh returns to same page.
- Add `data-family-slug` attributes on body for JS context.
- For the Bheekun seed, populate all "?" fields from README with reasonable defaults or `NULL`.
- The insurance decision log should be a dedicated view (read-only), populated from seed.
- Action items should be checkable (PUT to toggle status between Pending and Done).
