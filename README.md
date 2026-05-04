# 🏠 Family Financial Planner

A self-hosted micro SaaS for family financial planning. Built with Node.js, Express, SQLite, and vanilla HTML/JS.

## ✨ Features

- **Family Profile Management** — Track all family members, roles, and ages
- **Financial Status Tracking** — Accounts, debts, insurance coverage
- **Monthly Budget Tool** — Income & expense tracking with savings rate calculation
- **Goal Planning** — Short, medium, and long-term goals with progress bars
- **Investment Projections** — Compound interest calculator for retirement planning
- **Action Plan Checklist** — To-do items with completion tracking
- **Milestone Tracker** — Net worth goals with celebration plans
- **PDF Export** — Print-ready financial reports
- **Net Worth Dashboard** — Live calculations (Assets - Liabilities)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Initialize database (creates planner.db)
npm run migrate

# 3. Seed Bheekun family data
node scripts/seed-bheekun.js

# 4. Start the server
npm start
```

The app will be available at: **http://localhost:3000**

Open the dashboard: **http://localhost:3000/#/bheekun/dashboard**

## 🏗️ Architecture

```
src/
├── server.js              # Express app entry point
├── db/
│   ├── database.js         # SQLite connection
│   ├── queries.js         # Async query wrapper
│   ├── schema.sql         # Database schema
│   └── migrate.js         # Migration runner
├── routes/
│   ├── families.js        # Family CRUD
│   ├── members.js         # Family members
│   ├── accounts.js        # Financial accounts
│   ├── debts.js           # Liabilities
│   ├── insurance.js       # Insurance policies
│   ├── goals.js           # Financial goals
│   ├── budget.js          # Monthly budget
│   ├── actions.js         # Action items
│   ├── milestones.js      # Milestones
│   ├── summary.js         # Net worth calculations
│   └── projections.js     # Investment math engine
├── middleware/
│   └── familySlug.js      # Validates family slug
└── utils/
    └── response.js         # API response wrapper

public/
├── index.html              # SPA shell
├── css/
│   └── styles.css          # Main stylesheet
├── js/
│   ├── api.js              # Fetch wrapper
│   ├── router.js           # Hash-based router
│   └── app.js              # Page controllers
└── pages/
    ├── dashboard.html      # Overview page
    ├── family.html         # Members page
    ├── finances.html       # Accounts & debts
    ├── budget.html         # Monthly budget
    ├── goals.html          # Goals + projections
    ├── insurance.html      # Coverage decisions
    ├── actions.html        # To-do checklist
    └── milestones.html     # Milestones
```

## 📊 Data Model

### Family
| Field | Type | Description |
|-------|------|-------------|
| name | TEXT | Family name |
| slug | TEXT | URL-friendly identifier |
| location | TEXT | City/Province |
| tax_situation | TEXT | Marginal tax rate |

### Accounts
| Field | Type | Description |
|-------|------|-------------|
| type | TEXT | TFSA, RRSP, Emergency Fund, etc. |
| institution | TEXT | Bank/Broker |
| balance | REAL | Current balance |
| contribution_room | TEXT | e.g. "$0 / $78,000" |

### Budget Entries
| Field | Type | Description |
|-------|------|-------------|
| month_year | TEXT | YYYY-MM |
| category | TEXT | Housing, Food, Salary, etc. |
| type | TEXT | income or expense |
| amount | REAL | Dollar amount |

## 🔢 Financial Calculations

### Net Worth
```
Net Worth = SUM(accounts.balance) - SUM(debts.balance)
```

### Savings Rate
```
Savings Rate = (Total Income - Total Expenses) / Total Income × 100
```

### Compound Interest Projection
```javascript
// Monthly compounding
balance = balance * (1 + monthlyRate) + monthlyContribution
```

## 📝 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/families/:slug | Full family profile |
| GET | /api/families/:slug/members | List members |
| POST | /api/families/:slug/members | Add member |
| GET | /api/families/:slug/accounts | List accounts |
| POST | /api/families/:slug/accounts | Add account |
| GET | /api/families/:slug/debts | List debts |
| GET | /api/families/:slug/insurance | List insurance |
| GET | /api/families/:slug/goals | List goals |
| GET | /api/families/:slug/budget | List budget entries |
| POST | /api/families/:slug/budget | Add entry |
| GET | /api/families/:slug/actions | List actions |
| GET | /api/families/:slug/milestones | List milestones |
| GET | /api/families/:slug/summary | Net worth summary |
| POST | /api/families/:slug/project | Investment projection |

## 🖨️ PDF Export

Click the **"Export PDF"** button in the sidebar to generate a print-ready financial report. Uses browser print with `@media print` CSS for clean formatting.

## 🧪 Testing

### API Test
```bash
curl http://localhost:3000/api/families/bheekun
```

### Projection Test
```bash
curl -X POST http://localhost:3000/api/families/bheekun/project \
  -H "Content-Type: application/json" \
  -d '{"principal":78000,"monthly_contribution":1000,"annual_rate":7,"years":27}'
```

## 🏡 Bheekun Family Seed Data

The seed script (`scripts/seed-bheekun.js`) pre-populates the database with:

- **3 Family Members:** Yasser (Primary Income, 38), Wife, Kids
- **3 Accounts:** TFSA ($0/$78K room), RRSP ($0/~$130K room), Emergency Fund
- **3 Debts:** Mortgage, Car Loan, Credit Cards (placeholder)
- **4 Insurance:** Mortgage Life (Active), Term Life (Gap), Critical Illness (Gap), Disability (Pending)
- **5 Goals:** Emergency Fund $10K, TFSA $15K, RRSP $10K, Retirement $500K each
- **9 Action Items:** Week 1 Foundation, Week 2 Account Setup, Month 1 Funding
- **3 Milestones:** Emergency Fund $10K (2026), TFSA Maxed $78K (2033), RRSP $100K (2036)

All real data can be edited through the web UI.
