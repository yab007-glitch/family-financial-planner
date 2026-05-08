import { TaxEngine } from './taxEngine';

export interface WithdrawalStrategy {
    name: string;
    totalTax: number;
    yearsLasted: number;
    estateValue: number;
    order: string[];
}

export class WithdrawalOptimizer {
    private engine = new TaxEngine(2025);

    public compareStrategies(params: {
        desiredSpending: number,
        rrsp: number,
        tfsa: number,
        nonReg: number,
        cpp: number,
        oas: number,
        taxProvince: string
    }) {
        const { desiredSpending, rrsp, tfsa, nonReg, cpp, oas } = params;
        const guaranteed = cpp + oas;
        
        // 1. TFSA First Strategy
        const tfsaFirst = this.simulate('TFSA First', params, ['tfsa', 'nonReg', 'rrsp']);
        
        // 2. RRSP First (Tax-Bracket Filling to 15% or 20%)
        const rrspFirst = this.simulate('RRSP First', params, ['rrsp', 'nonReg', 'tfsa']);
        
        // 3. Tax-Efficient Blend
        const optimized = this.simulate('Tax Optimized', params, ['nonReg', 'rrsp', 'tfsa']);

        return {
            strategies: [tfsaFirst, rrspFirst, optimized],
            best: [tfsaFirst, rrspFirst, optimized].sort((a, b) => b.estateValue - a.estateValue)[0],
            recommendation: "Drawing from Taxable (Non-Reg) accounts first allows your RRSP/TFSA to grow longer. However, if your current tax bracket is low, 'meltdown' some RRSP early to avoid a huge tax bill later."
        };
    }

    private simulate(name: string, params: any, order: string[]): WithdrawalStrategy {
        let { rrsp, tfsa, nonReg } = params;
        const { desiredSpending, cpp, oas } = params;
        const guaranteed = cpp + oas;
        
        let totalTaxPaid = 0;
        let years = 0;
        const inflation = 1.02;
        const growth = 1.05;
        let currentTarget = desiredSpending;

        while (years < 35) {
            if (rrsp + tfsa + nonReg + guaranteed < currentTarget) break;
            
            let needed = currentTarget - guaranteed;
            let taxThisYear = 0;
            
            for (const acct of order) {
                if (needed <= 0) break;

                if (acct === 'nonReg' && nonReg > 0) {
                    const withdraw = Math.min(needed, nonReg);
                    nonReg -= withdraw;
                    needed -= withdraw;
                } else if (acct === 'rrsp' && rrsp > 0) {
                    // RRSP withdrawals are taxable
                    const marginal = this.engine.getMarginalRate(guaranteed + needed).combined;
                    const grossUp = needed / (1 - marginal);
                    const withdraw = Math.min(grossUp, rrsp);
                    const actualTax = withdraw * marginal;
                    
                    rrsp -= withdraw;
                    taxThisYear += actualTax;
                    needed -= (withdraw - actualTax);
                } else if (acct === 'tfsa' && tfsa > 0) {
                    const withdraw = Math.min(needed, tfsa);
                    tfsa -= withdraw;
                    needed -= withdraw;
                }
            }

            totalTaxPaid += taxThisYear;
            rrsp *= growth;
            tfsa *= growth;
            nonReg *= growth;
            currentTarget *= inflation;
            years++;
        }

        return {
            name,
            totalTax: Math.round(totalTaxPaid),
            yearsLasted: years,
            estateValue: Math.round(rrsp + tfsa + nonReg),
            order
        };
    }
}
