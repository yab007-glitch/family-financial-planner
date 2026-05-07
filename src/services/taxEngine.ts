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

const TAX_DATA: Record<number, {
    federalBrackets: Bracket[];
    quebecBrackets: Bracket[];
    federalBPA: number;
    quebecBPA: number;
    limits: {
        qpp_max: number;
        ei_max: number;
        qpip_max: number;
        rrsp_max: number;
        tfsa_max: number;
        fhsa_max: number;
    }
}> = {
    2024: {
        federalBrackets: [
            { limit: 55867, rate: 0.15 },
            { limit: 111733, rate: 0.205 },
            { limit: 173205, rate: 0.26 },
            { limit: 246752, rate: 0.29 },
            { limit: Infinity, rate: 0.33 },
        ],
        quebecBrackets: [
            { limit: 51780, rate: 0.14 },
            { limit: 103545, rate: 0.19 },
            { limit: 126000, rate: 0.24 },
            { limit: Infinity, rate: 0.2575 },
        ],
        federalBPA: 15705,
        quebecBPA: 17183,
        limits: {
            qpp_max: 68500,
            ei_max: 63200,
            qpip_max: 94000,
            rrsp_max: 31560,
            tfsa_max: 7000,
            fhsa_max: 8000
        }
    },
    2025: {
        federalBrackets: [
            { limit: 55867, rate: 0.15 },
            { limit: 111733, rate: 0.205 },
            { limit: 173205, rate: 0.26 },
            { limit: 246752, rate: 0.29 },
            { limit: Infinity, rate: 0.33 },
        ],
        quebecBrackets: [
            { limit: 51780, rate: 0.14 },
            { limit: 103545, rate: 0.19 },
            { limit: 126000, rate: 0.24 },
            { limit: Infinity, rate: 0.2575 },
        ],
        federalBPA: 16129,
        quebecBPA: 17183,
        limits: {
            qpp_max: 71300,
            ei_max: 65700,
            qpip_max: 97600,
            rrsp_max: 32490,
            tfsa_max: 7000,
            fhsa_max: 8000
        }
    }
};

const RESP_CESG_MATCH_RATE = 0.20;
const RESP_CESG_MAX_ANNUAL = 500;

export class TaxEngine {
    private federalBrackets: Bracket[];
    private quebecBrackets: Bracket[];
    private federalBPA: number;
    private quebecBPA: number;
    private limits: typeof TAX_DATA[number]['limits'];

    constructor(public year: number = 2025) {
        const data = TAX_DATA[year] || TAX_DATA[2025];
        this.federalBrackets = data.federalBrackets;
        this.quebecBrackets = data.quebecBrackets;
        this.federalBPA = data.federalBPA;
        this.quebecBPA = data.quebecBPA;
        this.limits = data.limits;
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

    /**
     * Calculates combined benefit recovery (Tax + CCB gain + Solidarity gain)
     * This is the "Secret Sauce" for Canadian planning.
     */
    public calculateContributionImpact(income: number, contribution: number, numChildren: number = 0) {
        const taxableAfter = Math.max(0, income - contribution);
        
        // 1. Tax Impact
        const fedBefore = this.calculateFederalTax(income);
        const fedAfter = this.calculateFederalTax(taxableAfter);
        const qcBefore = this.calculateQuebecTax(income);
        const qcAfter = this.calculateQuebecTax(taxableAfter);
        const taxRefund = (fedBefore + qcBefore) - (fedAfter + qcAfter);

        // 2. CCB Impact (Approx 7% recovery per child in mid-income)
        const ccbBefore = this.calculateCCB(income, numChildren);
        const ccbAfter = this.calculateCCB(taxableAfter, numChildren);
        const ccbGain = ccbAfter.annualBenefit - ccbBefore.annualBenefit;

        const totalBenefit = taxRefund + ccbGain;

        return {
            contribution,
            taxRefund: Math.round(taxRefund),
            ccbGain: Math.round(ccbGain),
            totalBenefit: Math.round(totalBenefit),
            effectiveRecoveryRate: contribution > 0 ? Math.round((totalBenefit / contribution) * 10000) / 100 : 0,
        };
    }

    public calculateFullTaxReturn(grossIncome: number, rrspContribution: number = 0, numChildren: number = 0) {
        const taxableIncome = Math.max(0, grossIncome - rrspContribution);
        const federalTax = this.calculateFederalTax(taxableIncome);
        const quebecTax = this.calculateQuebecTax(taxableIncome);

        const federalBPCredit = this.federalBPA * 0.15;
        const quebecBPCredit = this.quebecBPA * 0.14;

        const qpp = Math.max(0, Math.min(grossIncome, this.limits.qpp_max) - 3500) * 0.06;
        const ei = Math.min(grossIncome, this.limits.ei_max) * 0.0164;
        const qpip = Math.min(grossIncome, this.limits.qpip_max) * 0.00494;

        const netFederalTax = Math.max(0, federalTax - federalBPCredit);
        const netQuebecTax = Math.max(0, quebecTax - quebecBPCredit);

        const totalTax = netFederalTax + netQuebecTax + qpp + ei + qpip;
        const recovery = this.calculateContributionImpact(grossIncome, rrspContribution, numChildren);

        return {
            year: this.year,
            grossIncome,
            rrspContribution,
            taxableIncome,
            federalTax: Math.round(federalTax),
            quebecTax: Math.round(quebecTax),
            totalTax: Math.round(totalTax),
            afterTaxIncome: Math.round(grossIncome - totalTax),
            averageTaxRate: Math.round((totalTax / grossIncome) * 10000) / 100,
            rrspImpact: recovery
        };
    }

    public calculateResCESG(contribution: number, numChildren: number = 1) {
        const eligibleForMatch = Math.min(contribution, 2500 * numChildren);
        const annualGrant = Math.min(eligibleForMatch * RESP_CESG_MATCH_RATE, RESP_CESG_MAX_ANNUAL * numChildren);

        return {
            contribution,
            annualGrant: Math.round(annualGrant),
        };
    }

    /**
     * Precise 2025 CCB Formula (Approximate)
     */
    public calculateCCB(familyIncome: number, numChildren: number) {
        if (numChildren <= 0) return { annualBenefit: 0, monthlyBenefit: 0 };
        
        // Base max (depends on age <6 or 6-17, but we assume average $6,500/yr for planning)
        const maxPerChild = 6500; 
        const totalMax = numChildren * maxPerChild;
        
        const threshold1 = 36502; // Threshold for 2025
        const threshold2 = 79087;

        let reduction = 0;
        const surplus1 = Math.max(0, Math.min(familyIncome, threshold2) - threshold1);
        const surplus2 = Math.max(0, familyIncome - threshold2);

        // Reduction rates (based on child count)
        const rates = {
            1: { r1: 0.07, r2: 0.032 },
            2: { r1: 0.135, r2: 0.057 },
            3: { r1: 0.19, r2: 0.08 }
        };
        const r = rates[Math.min(numChildren, 3) as 1|2|3];
        
        reduction = (surplus1 * r.r1) + (surplus2 * r.r2);
        
        const benefit = Math.max(0, totalMax - reduction);
        return {
            annualBenefit: Math.round(benefit),
            monthlyBenefit: Math.round(benefit / 12)
        };
    }

    public getOptimalSavingsOrder(income: number, age: number, numChildren: number = 0) {
        const recovery = this.calculateContributionImpact(income, 1000, numChildren);
        const rate = recovery.effectiveRecoveryRate;
        const strategy: any[] = [];

        if (numChildren > 0) {
            strategy.push({ priority: 1, account: 'RESP', reason: 'Free 20% match - Highest ROI.' });
        }

        if (rate > 40) {
            strategy.push({ priority: 2, account: 'RRSP', reason: `High recovery rate of ${rate}%. Significant CCB + Tax boost.` });
            strategy.push({ priority: 3, account: 'TFSA', reason: 'Tax-free growth once RRSP maximized.' });
        } else {
            strategy.push({ priority: 2, account: 'TFSA', reason: 'Marginal benefit low. Prioritize tax-free flexibility.' });
            strategy.push({ priority: 3, account: 'RRSP', reason: 'Defer for higher income years.' });
        }

        return strategy;
    }
}
