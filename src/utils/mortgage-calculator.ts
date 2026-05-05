export interface MortgageParams {
  mortgageBalance?: number;
  mortgageRate?: number;
  monthlyPayment?: number;
  monthlySurplus?: number;
  expectedReturn?: number;
  marginalTaxRate?: number;
  years?: number;
  investmentType?: 'registered' | 'non-registered';
}

export interface MortgageResult {
  params: any;
  scenarioA: any;
  scenarioB: any;
  winner: string;
  difference: number;
  recommendation: any;
  breakEvenAnalysis: any;
}

export class MortgageVsInvestCalculator {
  static compare(params: MortgageParams): MortgageResult {
    const {
      mortgageBalance = 300000,
      mortgageRate = 4.5,
      monthlyPayment = 1500,
      monthlySurplus = 1000,
      expectedReturn = 7,
      marginalTaxRate = 0.33,
      years = 25,
      investmentType = 'registered',
    } = params;

    if (mortgageBalance < 0) throw new Error('Mortgage balance cannot be negative');
    if (mortgageRate < 0) throw new Error('Mortgage rate cannot be negative');
    if (monthlyPayment < 0) throw new Error('Monthly payment cannot be negative');
    if (monthlySurplus < 0) throw new Error('Monthly surplus cannot be negative');
    if (expectedReturn < 0) throw new Error('Expected return cannot be negative');
    if (marginalTaxRate < 0 || marginalTaxRate > 1) throw new Error('Marginal tax rate must be between 0 and 1');
    if (years <= 0) throw new Error('Years must be positive');

    const monthlyMortgageRate = mortgageRate / 100 / 12;
    const monthlyInvestRate = expectedReturn / 100 / 12;
    const months = years * 12;

    const scenarioA = this.simulatePrepayMortgage(mortgageBalance, monthlyMortgageRate, monthlyPayment, monthlySurplus, months);
    const scenarioB = this.simulateInvestSurplus(mortgageBalance, monthlyMortgageRate, monthlyPayment, monthlySurplus, monthlyInvestRate, months, investmentType, marginalTaxRate);

    const netWorthA = scenarioA.homeEquity;
    const netWorthB = scenarioB.homeEquity + scenarioB.investmentValue;
    const winner = netWorthB > netWorthA ? 'invest' : 'prepay';
    const difference = Math.abs(netWorthB - netWorthA);

    return {
      params: {
        mortgageBalance, mortgageRate, monthlyPayment, monthlySurplus,
        expectedReturn, marginalTaxRate, years, investmentType,
      },
      scenarioA: {
        name: 'Prepay Mortgage',
        mortgagePaidOffMonth: scenarioA.mortgagePaidOffMonth,
        totalInterestSaved: Math.round(scenarioA.totalInterestSaved),
        homeEquity: Math.round(scenarioA.homeEquity),
        netWorth: Math.round(netWorthA),
        yearsToPayoff: Math.round(((scenarioA.mortgagePaidOffMonth || months) / 12) * 10) / 10,
      },
      scenarioB: {
        name: 'Invest Surplus',
        mortgagePaidOffMonth: scenarioB.mortgagePaidOffMonth,
        totalInterestPaid: Math.round(scenarioB.totalInterestPaid),
        homeEquity: Math.round(scenarioB.homeEquity),
        investmentValue: Math.round(scenarioB.investmentValue),
        investmentValueAfterTax: Math.round(scenarioB.investmentValueAfterTax),
        netWorth: Math.round(netWorthB),
        yearsToPayoff: Math.round(((scenarioB.mortgagePaidOffMonth || months) / 12) * 10) / 10,
      },
      winner,
      difference: Math.round(difference),
      recommendation: this.generateRecommendation(winner, mortgageRate, expectedReturn, investmentType),
      breakEvenAnalysis: {
        requiredReturnForInvestToWin: this.findBreakEvenRate(mortgageBalance, monthlyMortgageRate, monthlyPayment, monthlySurplus, months),
      },
    };
  }

  private static simulatePrepayMortgage(balance: number, monthlyRate: number, basePayment: number, extraPayment: number, months: number) {
    let currentBalance = balance;
    let totalPaid = 0;
    let mortgagePaidOffMonth: number | null = null;
    const originalTotalInterest = this.calculateTotalInterest(balance, monthlyRate, basePayment);

    for (let m = 1; m <= months; m++) {
      if (currentBalance <= 0) break;
      const interest = currentBalance * monthlyRate;
      const payment = Math.min(basePayment + extraPayment, currentBalance + interest);
      const principal = payment - interest;
      currentBalance -= principal;
      totalPaid += payment;
      if (currentBalance <= 0 && !mortgagePaidOffMonth) mortgagePaidOffMonth = m;
    }

    const remainingBalance = Math.max(0, currentBalance);
    const actualInterest = totalPaid - (balance - remainingBalance);
    const totalInterestSaved = originalTotalInterest - actualInterest;

    return {
      homeEquity: balance - remainingBalance,
      remainingBalance: Math.round(remainingBalance),
      totalInterestSaved: Math.round(totalInterestSaved),
      mortgagePaidOffMonth,
    };
  }

  private static simulateInvestSurplus(balance: number, monthlyRate: number, basePayment: number, extraPayment: number, investRate: number, months: number, investmentType: string, taxRate: number) {
    let currentBalance = balance;
    let investmentValue = 0;
    let totalInterestPaid = 0;
    let mortgagePaidOffMonth: number | null = null;

    for (let m = 1; m <= months; m++) {
      if (currentBalance > 0) {
        const interest = currentBalance * monthlyRate;
        const payment = Math.min(basePayment, currentBalance + interest);
        const principal = payment - interest;
        currentBalance -= principal;
        totalInterestPaid += interest;
        if (currentBalance <= 0 && !mortgagePaidOffMonth) mortgagePaidOffMonth = m;
      }
      investmentValue = investmentValue * (1 + investRate) + extraPayment;
    }

    let investmentValueAfterTax = investmentValue;
    if (investmentType === 'non-registered') {
      const gain = investmentValue - (extraPayment * months);
      const taxableGain = gain * 0.5;
      const taxOnGain = taxableGain * taxRate;
      investmentValueAfterTax = investmentValue - taxOnGain;
    }

    return {
      homeEquity: balance - Math.max(0, currentBalance),
      remainingBalance: Math.round(Math.max(0, currentBalance)),
      investmentValue: Math.round(investmentValue),
      investmentValueAfterTax: Math.round(investmentValueAfterTax),
      totalInterestPaid: Math.round(totalInterestPaid),
      mortgagePaidOffMonth,
    };
  }

  private static calculateTotalInterest(principal: number, monthlyRate: number, monthlyPayment: number) {
    let balance = principal;
    let totalInterest = 0;
    let m = 0;
    while (balance > 0 && m < 600) {
      const interest = balance * monthlyRate;
      const payment = Math.min(monthlyPayment, balance + interest);
      const principalPaid = payment - interest;
      balance -= principalPaid;
      totalInterest += interest;
      m++;
    }
    return totalInterest;
  }

  private static findBreakEvenRate(balance: number, monthlyRate: number, basePayment: number, extraPayment: number, months: number) {
    let low = 0;
    let high = 20;
    for (let i = 0; i < 50; i++) {
      const mid = (low + high) / 2;
      const investRate = mid / 100 / 12;
      const scenarioA = this.simulatePrepayMortgage(balance, monthlyRate, basePayment, extraPayment, months);
      const scenarioB = this.simulateInvestSurplus(balance, monthlyRate, basePayment, extraPayment, investRate, months, 'registered', 0);
      const netWorthA = scenarioA.homeEquity;
      const netWorthB = scenarioB.homeEquity + scenarioB.investmentValue;
      if (netWorthB > netWorthA) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return Math.round(((low + high) / 2) * 100) / 100;
  }

  private static generateRecommendation(winner: string, mortgageRate: number, expectedReturn: number, investmentType: string) {
    if (winner === 'invest') {
      return {
        verdict: 'INVEST',
        summary: `Investing wins by generating higher net worth. Your expected return (${expectedReturn}%) exceeds your mortgage rate (${mortgageRate}%).`,
        caveat: investmentType === 'non-registered'
          ? 'Note: Non-registered investments are taxable. Use TFSA or RRSP to maximize advantage.'
          : 'Using registered accounts maximizes your advantage.',
        riskNote: 'Expected returns are not guaranteed. Mortgage prepayment is a guaranteed return equal to your interest rate.',
        action: '1. Max out TFSA room first (tax-free growth)\n2. Then RRSP (tax deduction + deferred growth)\n3. Keep minimum mortgage payments',
      };
    } else {
      return {
        verdict: 'PREPAY MORTGAGE',
        summary: `Prepaying wins. Your mortgage rate (${mortgageRate}%) exceeds your expected return (${expectedReturn}%).`,
        caveat: 'Guaranteed return equal to mortgage rate. No market risk.',
        riskNote: 'Once mortgage is paid off, redirect full payment amount to investments.',
        action: '1. Lump sum prepayments annually\n2. Increase monthly payment\n3. Consider bi-weekly accelerated payments',
      };
    }
  }
}

export default MortgageVsInvestCalculator;
