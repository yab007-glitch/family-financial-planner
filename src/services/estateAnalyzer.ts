import { FamilyDetail, Member, Debt, Account } from '../types';

export interface InsuranceGapResult {
  currentCoverage: number;
  neededCoverage: number;
  gap: number;
  breakdown: {
    debtRepayment: number;
    incomeReplacement: number;
    educationCosts: number;
    finalExpenses: number;
  };
  recommendation: string;
}

export class EstateAnalyzer {
  public static analyzeInsuranceGap(family: FamilyDetail, yearsOfIncomeReplacement = 10): InsuranceGapResult {
    const members = family.members || [];
    const debts = family.debts || [];
    const insurance = family.insurance || [];
    const accounts = family.accounts || [];

    // 1. Current Coverage
    const currentCoverage = insurance
      .filter(i => i.type.toLowerCase().includes('life') && i.status && i.status.toLowerCase() === 'active')
      .reduce((sum, i) => {
        // Handle premium strings like "$500,000" or just numbers
        const val = parseFloat(String(i.coverage).replace(/[^0-9.]/g, '')) || 0;
        return sum + val;
      }, 0);

    // 2. Needed Coverage Breakdown
    
    // Debt: Pay off everything but maybe keep low-interest if assets cover it
    const debtRepayment = debts.reduce((sum, d) => sum + (d.balance || 0), 0);

    // Income Replacement: Target roughly $60k/yr per income earner if they pass
    const earners = members.filter(m => m.role && m.role.toLowerCase().includes('income'));
    const incomeReplacement = earners.length > 0 ? ( earners.length * 60000 * yearsOfIncomeReplacement ) : 500000;

    // Education: $50k per child
    const children = members.filter(m => m.role && m.role.toLowerCase() === 'child');
    const educationCosts = children.length * 50000;

    const finalExpenses = 25000;

    const liquidAssets = accounts
      .filter(a => ['TFSA', 'Savings', 'Checking', 'Emergency Fund'].includes(a.type))
      .reduce((sum, a) => sum + (a.balance || 0), 0);

    const totalNeeded = debtRepayment + incomeReplacement + educationCosts + finalExpenses - liquidAssets;
    const gap = Math.max(0, totalNeeded - currentCoverage);

    let recommendation = '';
    if (gap > 500000) {
      recommendation = 'Significant gap identified. Consider a 20-year term life policy to cover your family during your peak earning years and until children finish school.';
    } else if (gap > 100000) {
      recommendation = 'Moderate coverage gap. Review your employee benefits (MUHC/Employer) to see if you can increase group life coverage.';
    } else {
      recommendation = 'Your current assets and insurance appear sufficient to cover major liabilities and provide for your family.';
    }

    return {
      currentCoverage,
      neededCoverage: Math.round(totalNeeded),
      gap: Math.round(gap),
      breakdown: {
        debtRepayment: Math.round(debtRepayment),
        incomeReplacement: Math.round(incomeReplacement),
        educationCosts: Math.round(educationCosts),
        finalExpenses
      },
      recommendation
    };
  }
}
