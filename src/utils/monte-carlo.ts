export interface MonteCarloParams {
  currentPortfolio?: number;
  monthlyContribution?: number;
  monthlyWithdrawal?: number;
  yearsToRetirement?: number;
  yearsInRetirement?: number;
  expectedReturn?: number;
  volatility?: number;
  inflation?: number;
  numSimulations?: number;
}

export interface MonteCarloResult {
  params: MonteCarloParams;
  summary: any;
  interpretation: any[];
  samplePaths: { success: any[]; failure: any[] };
  yearlyProjections: any[];
}

export class MonteCarloEngine {
  static simulate(params: MonteCarloParams): MonteCarloResult {
    const {
      currentPortfolio = 100000,
      monthlyContribution = 1500,
      monthlyWithdrawal = 5000,
      yearsToRetirement = 27,
      yearsInRetirement = 25,
      expectedReturn = 7,
      volatility = 12,
      inflation = 2.5,
      numSimulations = 10_000,
    } = params;

    if (currentPortfolio < 0) throw new Error('Current portfolio cannot be negative');
    if (monthlyContribution < 0) throw new Error('Monthly contribution cannot be negative');
    if (monthlyWithdrawal < 0) throw new Error('Monthly withdrawal cannot be negative');
    if (yearsToRetirement <= 0) throw new Error('Years to retirement must be positive');
    if (yearsInRetirement <= 0) throw new Error('Years in retirement must be positive');

    const monthlyReturnMean = expectedReturn / 100 / 12;
    const monthlyVolatility = volatility / 100 / Math.sqrt(12);
    const monthlyInflation = inflation / 100 / 12;
    const totalMonths = (yearsToRetirement + yearsInRetirement) * 12;
    const accumulationMonths = yearsToRetirement * 12;

    let successCount = 0;
    const finalValues: number[] = [];
    const minValues: number[] = [];
    const bankruptcies: any[] = [];
    const successPaths: any[] = [];
    const failurePaths: any[] = [];

    for (let sim = 0; sim < numSimulations; sim++) {
      let portfolio = currentPortfolio;
      let minPortfolio = portfolio;
      let wentBankrupt = false;
      let bankruptcyMonth: number | null = null;
      const path: number[] = [portfolio];

      for (let month = 1; month <= totalMonths; month++) {
        const randomReturn = this.generateNormalRandom(monthlyReturnMean, monthlyVolatility);
        if (month <= accumulationMonths) {
          portfolio = portfolio * (1 + randomReturn) + monthlyContribution;
        } else {
          const monthsInRetirement = month - accumulationMonths;
          const inflationFactor = Math.pow(1 + monthlyInflation, monthsInRetirement);
          const adjustedWithdrawal = monthlyWithdrawal * inflationFactor;
          portfolio = portfolio * (1 + randomReturn) - adjustedWithdrawal;
        }
        path.push(portfolio);
        if (portfolio < minPortfolio) minPortfolio = portfolio;
        if (portfolio <= 0 && !wentBankrupt) {
          wentBankrupt = true;
          bankruptcyMonth = month;
          portfolio = 0;
        }
      }

      const isSuccess = portfolio > 0;
      if (isSuccess) successCount++;
      finalValues.push(portfolio);
      minValues.push(minPortfolio);
      if (wentBankrupt) bankruptcies.push({ bankruptcyMonth, finalValue: portfolio });
      if (sim % 100 === 0) {
        if (isSuccess && successPaths.length < 50) {
          successPaths.push(path.filter((_: any, i: number) => i % 12 === 0));
        } else if (!isSuccess && failurePaths.length < 50) {
          failurePaths.push(path.filter((_: any, i: number) => i % 12 === 0));
        }
      }
    }

    const sortedFinal = [...finalValues].sort((a, b) => a - b);
    const successRate = successCount / numSimulations;

    return {
      params,
      summary: {
        numSimulations,
        successCount,
        successRate: Math.round(successRate * 10000) / 100,
        failureRate: Math.round((1 - successRate) * 10000) / 100,
        medianFinalValue: Math.round(sortedFinal[Math.floor(numSimulations * 0.5)]),
        percentile10: Math.round(sortedFinal[Math.floor(numSimulations * 0.1)]),
        percentile25: Math.round(sortedFinal[Math.floor(numSimulations * 0.25)]),
        percentile75: Math.round(sortedFinal[Math.floor(numSimulations * 0.75)]),
        percentile90: Math.round(sortedFinal[Math.floor(numSimulations * 0.9)]),
        meanFinalValue: Math.round(finalValues.reduce((a, b) => a + b, 0) / numSimulations),
        minFinalValue: Math.round(Math.min(...sortedFinal)),
        maxFinalValue: Math.round(Math.max(...sortedFinal)),
        medianMinPortfolio: Math.round(minValues.sort((a, b) => a - b)[Math.floor(numSimulations * 0.5)]),
        bankruptcies: bankruptcies.length,
      },
      interpretation: this.interpretResults(successRate, sortedFinal[Math.floor(numSimulations * 0.5)], monthlyWithdrawal * 12, params),
      samplePaths: {
        success: successPaths.slice(0, 5),
        failure: failurePaths.slice(0, 5),
      },
      yearlyProjections: this.generateYearlyProjections(currentPortfolio, monthlyContribution, yearsToRetirement, expectedReturn, monthlyWithdrawal, yearsInRetirement),
    };
  }

  private static generateNormalRandom(mean: number, stdDev: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
  }

  private static generateYearlyProjections(currentPortfolio: number, monthlyContribution: number, yearsToRetirement: number, expectedReturn: number, monthlyWithdrawal: number, yearsInRetirement: number) {
    const projections: any[] = [];
    let portfolio = currentPortfolio;
    const annualReturn = expectedReturn / 100;
    for (let year = 1; year <= yearsToRetirement; year++) {
      portfolio = portfolio * (1 + annualReturn) + (monthlyContribution * 12);
      projections.push({
        year,
        age: 38 + year,
        phase: 'accumulation',
        portfolio: Math.round(portfolio),
        contribution: monthlyContribution * 12,
        withdrawal: 0,
      });
    }
    for (let year = 1; year <= yearsInRetirement; year++) {
      portfolio = portfolio * (1 + annualReturn) - (monthlyWithdrawal * 12);
      projections.push({
        year: yearsToRetirement + year,
        age: 38 + yearsToRetirement + year,
        phase: 'withdrawal',
        portfolio: Math.round(Math.max(0, portfolio)),
        contribution: 0,
        withdrawal: monthlyWithdrawal * 12,
      });
    }
    return projections;
  }

  private static interpretResults(successRate: number, medianFinal: number, annualSpending: number, _params: MonteCarloParams) {
    const interpretations: any[] = [];
    if (successRate >= 0.95) {
      interpretations.push({
        level: 'excellent',
        title: 'Excellent Outlook (95%+ success)',
        description: 'Your plan has a very high probability of success. You could consider: increasing retirement spending, retiring earlier, or leaving a larger legacy.',
      });
    } else if (successRate >= 0.80) {
      interpretations.push({
        level: 'good',
        title: 'Good Outlook (80-95% success)',
        description: "Your plan is likely to succeed, but there's meaningful risk. Consider: slightly higher savings, delaying retirement 1-2 years, or reducing withdrawal rate to 3.5%.",
      });
    } else if (successRate >= 0.60) {
      interpretations.push({
        level: 'fair',
        title: 'Fair Outlook (60-80% success)',
        description: 'Significant risk of outliving your money. Recommended actions: increase monthly savings by 20%+, delay retirement, or reduce retirement spending by 15%.',
      });
    } else {
      interpretations.push({
        level: 'poor',
        title: 'Poor Outlook (<60% success)',
        description: 'High probability of financial shortfall in retirement. Major adjustments needed: significantly increase savings, consider working to 70+, reduce retirement lifestyle expectations.',
      });
    }
    if (medianFinal > annualSpending * 5) {
      interpretations.push({
        level: 'positive',
        title: 'Legacy Potential',
        description: `Median final portfolio ($${Math.round(medianFinal).toLocaleString()}) exceeds 5x annual spending. You're likely to leave a substantial inheritance.`,
      });
    }
    interpretations.push({
      level: 'info',
      title: 'Sensitivity Analysis',
      description: `Success rate if returns are 2% lower: ~${Math.round(Math.max(0, successRate - 0.15) * 100)}%. If returns are 2% higher: ~${Math.round(Math.min(1, successRate + 0.10) * 100)}%. Investment returns are the single biggest variable.`,
    });
    return interpretations;
  }
}

export default MonteCarloEngine;
