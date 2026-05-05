export interface Bracket {
    limit: number;
    rate: number;
}

export interface MarginalRateResponse {
    income: number;
    federal: number;
    quebec: number;
    combined: number;
    bracket: string;
}

const FEDERAL_BRACKETS_2025: Bracket[] = [
    { limit: 55867, rate: 0.15 },
    { limit: 111733, rate: 0.205 },
    { limit: 173205, rate: 0.26 },
    { limit: 246752, rate: 0.29 },
    { limit: Infinity, rate: 0.33 },
];

const QUEBEC_BRACKETS_2025: Bracket[] = [
    { limit: 51780, rate: 0.14 },
    { limit: 103545, rate: 0.19 },
    { limit: 126000, rate: 0.24 },
    { limit: Infinity, rate: 0.2575 },
];

const FEDERAL_BPA_2025 = 16129;
const QUEBEC_BPA_2025 = 17183;
const RESP_CESG_MATCH_RATE = 0.20;
const RESP_CESG_MAX_ANNUAL = 500;

export class TaxEngine {
    private federalBrackets: Bracket[];
    private quebecBrackets: Bracket[];

    constructor(public year: number = 2025) {
        this.federalBrackets = FEDERAL_BRACKETS_2025;
        this.quebecBrackets = QUEBEC_BRACKETS_2025;
    }

    private calculateBracketTax(taxableIncome: number, brackets: Bracket[]): number {
        let tax = 0;
        let remaining = taxableIncome;
        let previousLimit = 0;

        for (const bracket of brackets) {
            if (remaining <= 0) break;
            const taxableInBracket = Math.min(remaining, bracket.limit - previousLimit);
            tax += taxableInBracket * bracket.rate;
            remaining -= taxableInBracket;
            previousLimit = bracket.limit;
        }
        return Math.round(tax * 100) / 100;
    }

    public calculateFederalTax(taxableIncome: number): number {
        return this.calculateBracketTax(taxableIncome, this.federalBrackets);
    }

    public calculateQuebecTax(taxableIncome: number): number {
        return this.calculateBracketTax(taxableIncome, this.quebecBrackets);
    }

    private mapToKnownCombinedRate(income: number) {
        // Quebec-specific combined rates (approximate for planning)
        if (income <= 51780) return { rate: 0.2753, bracket: 'Bottom' };
        if (income <= 55867) return { rate: 0.3253, bracket: 'Lower-Mid' };
        if (income <= 103545) return { rate: 0.3712, bracket: 'Mid' };
        if (income <= 111733) return { rate: 0.4112, bracket: 'Mid-High' };
        if (income <= 126000) return { rate: 0.4571, bracket: 'High' };
        if (income <= 173205) return { rate: 0.4746, bracket: 'High-Top' };
        if (income <= 246752) return { rate: 0.4997, bracket: 'Top' };
        return { rate: 0.5331, bracket: 'Uber-High' };
    }

    public getMarginalRate(income: number): MarginalRateResponse {
        const fedRate = this.federalBrackets.find((b) => income <= b.limit)?.rate ?? 0.33;
        const qcRate = this.quebecBrackets.find((b) => income <= b.limit)?.rate ?? 0.2575;
        const combined = this.mapToKnownCombinedRate(income);

        return {
            income,
            federal: fedRate,
            quebec: qcRate,
            combined: combined.rate,
            bracket: combined.bracket,
        };
    }

    public calculateRRSPImpact(income: number, rrspContribution: number) {
        const taxableAfter = Math.max(0, income - rrspContribution);
        const fedBefore = this.calculateFederalTax(income);
        const fedAfter = this.calculateFederalTax(taxableAfter);
        const qcBefore = this.calculateQuebecTax(income);
        const qcAfter = this.calculateQuebecTax(taxableAfter);

        const taxRefund = (fedBefore + qcBefore) - (fedAfter + qcAfter);

        return {
            contribution: rrspContribution,
            taxRefund: Math.round(taxRefund),
            effectiveRate: rrspContribution > 0 ? Math.round((taxRefund / rrspContribution) * 10000) / 100 : 0,
        };
    }

    public calculateFullTaxReturn(grossIncome: number, rrspContribution: number = 0) {
        const taxableIncome = Math.max(0, grossIncome - rrspContribution);
        const federalTax = this.calculateFederalTax(taxableIncome);
        const quebecTax = this.calculateQuebecTax(taxableIncome);

        const federalBPCredit = FEDERAL_BPA_2025 * 0.15;
        const quebecBPCredit = QUEBEC_BPA_2025 * 0.14;

        // Payroll deductions (simplified)
        const qpp = Math.max(0, Math.min(grossIncome, 71300) - 3500) * 0.06;
        const ei = Math.min(grossIncome, 65700) * 0.0164;
        const qpip = Math.min(grossIncome, 97600) * 0.00494;

        const netFederalTax = Math.max(0, federalTax - federalBPCredit);
        const netQuebecTax = Math.max(0, quebecTax - quebecBPCredit);

        const totalTax = netFederalTax + netQuebecTax + qpp + ei + qpip;
        const marginalRate = this.getMarginalRate(taxableIncome).combined;
        const rrspImpact = this.calculateRRSPImpact(grossIncome, rrspContribution);

        return {
            grossIncome,
            rrspContribution,
            taxableIncome,
            federalTax: Math.round(federalTax),
            quebecTax: Math.round(quebecTax),
            netFederalTax: Math.round(netFederalTax),
            netQuebecTax: Math.round(netQuebecTax),
            payrollDeductions: {
                qpp: Math.round(qpp * 100) / 100,
                ei: Math.round(ei * 100) / 100,
                qpip: Math.round(qpip * 100) / 100,
                total: Math.round((qpp + ei + qpip) * 100) / 100,
            },
            totalTax: Math.round(totalTax),
            afterTaxIncome: Math.round(grossIncome - totalTax),
            averageTaxRate: Math.round((totalTax / grossIncome) * 10000) / 100,
            marginalTaxRate: marginalRate,
            rrspRefund: rrspImpact.taxRefund,
            rrspEffectiveRate: rrspImpact.effectiveRate,
        };
    }

    public calculateResCESG(contribution: number, numChildren: number = 1) {
        const eligibleForMatch = Math.min(contribution, 2500 * numChildren);
        const annualGrant = Math.min(eligibleForMatch * RESP_CESG_MATCH_RATE, RESP_CESG_MAX_ANNUAL * numChildren);

        return {
            contribution,
            eligibleForMatch,
            annualGrant: Math.round(annualGrant),
            grantRate: RESP_CESG_MATCH_RATE,
            maxAnnualPerChild: RESP_CESG_MAX_ANNUAL,
        };
    }

    public calculateCCB(familyIncome: number, numChildren: number, _childrenAges: number[]) {
        const maxAnnual = numChildren * 6997;
        const reduction = Math.max(0, familyIncome - 34563);
        const reduced = Math.max(0, maxAnnual - reduction * 0.07);
        return {
            monthlyBenefit: Math.round(reduced / 12),
            annualBenefit: Math.round(reduced),
        };
    }

    public getOptimalSavingsOrder(income: number, age: number, numChildren: number = 0) {
        const marginal = this.getMarginalRate(income).combined;
        const strategy: any[] = [];

        if (numChildren > 0) {
            strategy.push({ priority: 1, account: 'RESP', reason: 'Free 20% CESG match = guaranteed ROI. Maximize before children turn 17.' });
        }

        if (marginal < 0.30) {
            strategy.push({ priority: 2, account: 'TFSA', reason: `Marginal rate ${(marginal * 100).toFixed(1)}% < 30%. Use TFSA now, switch to RRSP later.` });
            strategy.push({ priority: 3, account: 'RRSP (deferred deduction)', reason: 'Contribute now for tax-deferred growth, but save the deduction for a higher income year.' });
        } else {
            strategy.push({ priority: 2, account: 'RRSP', reason: `Marginal rate ${(marginal * 100).toFixed(1)}% > 30%. Every $1,000 = $${(marginal * 1000).toFixed(0)} tax refund.` });
            strategy.push({ priority: 3, account: 'TFSA', reason: 'After RRSP room exhausted, use TFSA for additional tax-free growth.' });
        }

        if (age >= 18) {
            strategy.push({ priority: 4, account: 'FHSA', reason: 'Best of both worlds: tax deduction + tax-free withdrawal for first home.' });
        }

        strategy.push({ priority: 5, account: 'Spousal RRSP', reason: 'If spouse earns less, contribute and they withdraw in retirement at lower tax rate.' });
        strategy.push({ priority: 6, account: 'Non-registered', reason: 'Horizons swap ETFs or XEQT. Only after all registered accounts maxed.' });

        return strategy;
    }
}
