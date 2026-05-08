// ============================================================
// Shared TypeScript interfaces for the Family Financial Planner
// ============================================================

export interface User {
    id: number;
    email: string;
    name: string;
    created_at: string;
    last_login_at: string | null;
}

export interface Family {
    id: number;
    user_id: number;
    name: string;
    slug: string;
    location: string | null;
    tax_situation: string | null;
    created_at: string;
}

export interface Member {
    id: number;
    family_id: number;
    name: string;
    role: string | null;
    age: number | null;
    notes: string | null;
}

export interface Account {
    id: number;
    family_id: number;
    type: string;
    institution: string | null;
    balance: number;
    symbol?: string | null;
    units?: number | null;
    last_price?: number | null;
    last_price_at?: string | null;
    asset_class?: string | null; // #PortfolioGovernance
    target_percent?: number | null; // #PortfolioGovernance
    contribution_room: string | null;
    target_allocation: number | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface Debt {
    id: number;
    family_id: number;
    type: string;
    balance: number;
    interest_rate: number | null;
    monthly_payment: number | null;
    original_amount: number | null;
    start_date: string | null;
    notes: string | null;
}

export interface Insurance {
    id: number;
    family_id: number;
    type: string;
    provider: string | null;
    coverage: string | null;
    premium: string | null;
    status: string | null;
    renewal_date: string | null;
    notes: string | null;
}

export interface Goal {
    id: number;
    family_id: number;
    timeframe: string | null;
    priority: number | null;
    description: string | null;
    target_amount: number;
    current_amount: number;
    monthly_contribution: number;
    deadline: string | null;
    status: string;
    project_return: number;
    notes: string | null;
}

export interface BudgetEntry {
    id: number;
    family_id: number;
    month_year: string | null;
    category: string | null;
    subcategory: string | null;
    amount: number;
    type: 'income' | 'expense';
    notes: string | null;
    created_at: string;
}

export interface ActionItem {
    id: number;
    family_id: number;
    phase: string | null;
    description: string | null;
    status: string;
    due_date: string | null;
    completed_at: string | null;
    notes: string | null;
}

export interface Milestone {
    id: number;
    family_id: number;
    name: string;
    target_date: string | null;
    status: string;
    celebration_plan: string | null;
}

export interface RecurringItem {
    id: number;
    family_id: number;
    name: string;
    category: string | null;
    subcategory: string | null;
    amount: number;
    type: 'income' | 'expense';
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
    start_date: string | null;
    end_date: string | null;
    active: number;
}

export interface NetWorthSnapshot {
    id: number;
    family_id: number;
    snapshot_date: string;
    assets: number;
    liabilities: number;
    net_worth: number;
    savings_rate: number | null;
}

export interface AuditLog {
    id: number;
    family_id: number;
    user_id: number;
    action: string;
    entity_type: string;
    entity_id: number | null;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
}

// Auth-related types
export interface AuthTokenPayload {
    userId: number;
    email: string;
}

export interface AuthResponse {
    id: number;
    email: string;
    name: string;
    csrfToken: string;
}

export interface FamilyDetail extends Family {
    members?: Member[];
    accounts?: Account[];
    debts?: Debt[];
    insurance?: Insurance[];
    goals?: Goal[];
    budget?: BudgetEntry[];
    actions?: ActionItem[];
    milestones?: Milestone[];
    recurring?: RecurringItem[];
    snapshots?: NetWorthSnapshot[];
}

export interface HealthScoreResult {
    score: number;
    categories: {
        liquidity: number;
        debt: number;
        savings: number;
        tax: number;
        estate: number;
    };
    recommendations: string[];
    alerts: { text: string, severity: 'critical' | 'warning' | 'info' }[];
    taxWindows?: {
        marginalRate: number;
        windowType: 'Standard' | 'Low Tax Window' | 'Peak Earning';
        recommendation: string;
    };
}

// Financial calculation types
export interface TaxCalculationResult {
    grossIncome: number;
    rrspContribution: number;
    taxableIncome: number;
    federalTax: number;
    quebecTax: number;
    netFederalTax: number;
    netQuebecTax: number;
    payrollDeductions: {
        qpp: number;
        ei: number;
        qpip: number;
        total: number;
    };
    totalTax: number;
    afterTaxIncome: number;
    averageTaxRate: number;
    marginalTaxRate: number;
    rrspRefund: number;
    rrspEffectiveRate: number;
}

export interface GoalPlanInput {
    targetAmount: number;
    currentAmount: number;
    monthlyContribution: number;
    annualReturn: number;
    years: number;
}