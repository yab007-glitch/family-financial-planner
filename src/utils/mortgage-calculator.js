/**
 * Mortgage vs Investment Calculator
 * Compares prepaying mortgage vs investing surplus
 */
class MortgageVsInvestCalculator {
  /**
   * Compare two strategies over N years
   * @param {Object} params
   * @param {number} params.mortgageBalance - Current mortgage balance
   * @param {number} params.mortgageRate - Annual interest rate (e.g., 4.5)
   * @param {number} params.monthlyPayment - Current monthly mortgage payment
   * @param {number} params.monthlySurplus - Extra cash available per month
   * @param {number} params.expectedReturn - Expected investment return % (e.g., 7)
   * @param {number} params.marginalTaxRate - Marginal tax rate (e.g., 0.33)
   * @param {number} params.years - Time horizon in years
   * @param {string} params.investmentType - 'registered' (TFSA/RRSP) or 'non-registered'
   */
  static compare(params) {
    const {
      mortgageBalance = 300000,
      mortgageRate = 4.5,
      monthlyPayment = 1500,
      monthlySurplus = 1000,
      expectedReturn = 7,
      marginalTaxRate = 0.33,
      years = 25,
      investmentType = 'registered'
    } = params;

    const monthlyMortgageRate = mortgageRate / 100 / 12;
    const monthlyInvestRate = expectedReturn / 100 / 12;
    const months = years * 12;

    // Strategy A: Prepay Mortgage
    const scenarioA = this.simulatePrepayMortgage(
      mortgageBalance, monthlyMortgageRate, monthlyPayment, monthlySurplus, months
    );

    // Strategy B: Invest Surplus
    const scenarioB = this.simulateInvestSurplus(
      mortgageBalance, monthlyMortgageRate, monthlyPayment, monthlySurplus,
      monthlyInvestRate, months, investmentType, marginalTaxRate
    );

    // Determine winner
    const netWorthA = scenarioA.homeEquity;
    const netWorthB = scenarioB.homeEquity + scenarioB.investmentValue;
    const winner = netWorthB > netWorthA ? 'invest' : 'prepay';
    const difference = Math.abs(netWorthB - netWorthA);

    return {
      params: {
        mortgageBalance, mortgageRate, monthlyPayment, monthlySurplus,
        expectedReturn, marginalTaxRate, years, investmentType
      },
      scenarioA: {
        name: 'Prepay Mortgage',
        mortgagePaidOffMonth: scenarioA.mortgagePaidOffMonth,
        totalInterestSaved: Math.round(scenarioA.totalInterestSaved),
        homeEquity: Math.round(scenarioA.homeEquity),
        netWorth: Math.round(netWorthA),
        yearsToPayoff: Math.round((scenarioA.mortgagePaidOffMonth || months) / 12 * 10) / 10
      },
      scenarioB: {
        name: 'Invest Surplus',
        mortgagePaidOffMonth: scenarioB.mortgagePaidOffMonth,
        totalInterestPaid: Math.round(scenarioB.totalInterestPaid),
        homeEquity: Math.round(scenarioB.homeEquity),
        investmentValue: Math.round(scenarioB.investmentValue),
        investmentValueAfterTax: Math.round(scenarioB.investmentValueAfterTax),
        netWorth: Math.round(netWorthB),
        yearsToPayoff: Math.round((scenarioB.mortgagePaidOffMonth || months) / 12 * 10) / 10
      },
      winner,
      difference: Math.round(difference),
      recommendation: this.generateRecommendation(winner, mortgageRate, expectedReturn, investmentType),
      breakEvenAnalysis: {
        requiredReturnForInvestToWin: this.findBreakEvenRate(
          mortgageBalance, monthlyMortgageRate, monthlyPayment, monthlySurplus, months
        )
      }
    };
  }

  static simulatePrepayMortgage(balance, monthlyRate, basePayment, extraPayment, months) {
    let currentBalance = balance;
    let totalInterestSaved = 0;
    let totalPaid = 0;
    let mortgagePaidOffMonth = null;
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
    totalInterestSaved = originalTotalInterest - actualInterest;

    return {
      homeEquity: balance - remainingBalance,
      remainingBalance: Math.round(remainingBalance),
      totalInterestSaved: Math.round(totalInterestSaved),
      mortgagePaidOffMonth
    };
  }

  static simulateInvestSurplus(balance, monthlyRate, basePayment, extraPayment, investRate, months, investmentType, taxRate) {
    let currentBalance = balance;
    let investmentValue = 0;
    let totalInterestPaid = 0;
    let mortgagePaidOffMonth = null;

    for (let m = 1; m <= months; m++) {
      // Mortgage payment
      if (currentBalance > 0) {
        const interest = currentBalance * monthlyRate;
        const payment = Math.min(basePayment, currentBalance + interest);
        const principal = payment - interest;
        currentBalance -= principal;
        totalInterestPaid += interest;
        if (currentBalance <= 0 && !mortgagePaidOffMonth) mortgagePaidOffMonth = m;
      }

      // Invest surplus
      investmentValue = investmentValue * (1 + investRate) + extraPayment;
    }

    // Calculate after-tax value
    let investmentValueAfterTax = investmentValue;
    if (investmentType === 'non-registered') {
      // Simplified: assume half the growth is capital gains, taxed at half marginal rate
      const gain = investmentValue - (extraPayment * months);
      const taxableGain = gain * 0.5; // 50% inclusion rate
      const taxOnGain = taxableGain * taxRate;
      investmentValueAfterTax = investmentValue - taxOnGain;
    }

    return {
      homeEquity: balance - Math.max(0, currentBalance),
      remainingBalance: Math.round(Math.max(0, currentBalance)),
      investmentValue: Math.round(investmentValue),
      investmentValueAfterTax: Math.round(investmentValueAfterTax),
      totalInterestPaid: Math.round(totalInterestPaid),
      mortgagePaidOffMonth
    };
  }

  static calculateTotalInterest(principal, monthlyRate, monthlyPayment) {
    let balance = principal;
    let totalInterest = 0;
    let months = 0;
    while (balance > 0 && months < 600) {
      const interest = balance * monthlyRate;
      const payment = Math.min(monthlyPayment, balance + interest);
      const principalPaid = payment - interest;
      balance -= principalPaid;
      totalInterest += interest;
      months++;
    }
    return totalInterest;
  }

  static findBreakEvenRate(balance, monthlyRate, basePayment, extraPayment, months) {
    // Binary search to find the investment return where both strategies have equal net worth
    let low = 0;
    let high = 20; // 20% annual
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

  static generateRecommendation(winner, mortgageRate, expectedReturn, investmentType) {
    if (winner === 'invest') {
      return {
        verdict: 'INVEST',
        summary: `Investing wins by generating higher net worth. Your expected return (${expectedReturn}%) exceeds your mortgage rate (${mortgageRate}%).`,
        caveat: investmentType === 'non-registered'
          ? 'Note: Non-registered investments are taxable. Use TFSA or RRSP to maximize advantage.'
          : 'Using registered accounts maximizes your advantage.',
        riskNote: 'Expected returns are not guaranteed. Mortgage prepayment is a guaranteed return equal to your interest rate.',
        action: '1. Max out TFSA room first (tax-free growth)\n2. Then RRSP (tax deduction + deferred growth)\n3. Keep minimum mortgage payments'
      };
    } else {
      return {
        verdict: 'PREPAY MORTGAGE',
        summary: `Prepaying wins. Your mortgage rate (${mortgageRate}%) exceeds your expected return (${expectedReturn}%).`,
        caveat: 'Guaranteed return equal to mortgage rate. No market risk.',
        riskNote: 'Once mortgage is paid off, redirect full payment amount to investments.',
        action: '1. Lump sum prepayments annually\n2. Increase monthly payment\n3. Consider bi-weekly accelerated payments'
      };
    }
  }
}

module.exports = MortgageVsInvestCalculator;
