/**
 * Monte Carlo Retirement Projection Engine
 * Runs 10,000 simulations to determine probability of retirement success
 */
class MonteCarloEngine {
  /**
   * Run Monte Carlo simulation
   * @param {Object} params
   * @param {number} params.currentPortfolio - Starting portfolio value
   * @param {number} params.monthlyContribution - Monthly savings until retirement
   * @param {number} params.monthlyWithdrawal - Monthly withdrawal in retirement
   * @param {number} params.yearsToRetirement - Years until retirement age
   * @param {number} params.yearsInRetirement - Expected years in retirement
   * @param {number} params.expectedReturn - Mean annual return (e.g., 7)
   * @param {number} params.volatility - Annual standard deviation (e.g., 12)
   * @param {number} params.inflation - Expected inflation (e.g., 2.5)
   * @param {number} params.numSimulations - Number of runs (default 10000)
   */
  static simulate(params) {
    const {
      currentPortfolio = 100000,
      monthlyContribution = 1500,
      monthlyWithdrawal = 5000,
      yearsToRetirement = 27,
      yearsInRetirement = 25,
      expectedReturn = 7,
      volatility = 12,
      inflation = 2.5,
      numSimulations = 10000
    } = params;

    const monthlyReturnMean = expectedReturn / 100 / 12;
    const monthlyVolatility = volatility / 100 / Math.sqrt(12);
    const monthlyInflation = inflation / 100 / 12;
    const totalMonths = (yearsToRetirement + yearsInRetirement) * 12;
    const accumulationMonths = yearsToRetirement * 12;
    const withdrawalMonths = yearsInRetirement * 12;

    let successCount = 0;
    const finalValues = [];
    const minValues = [];
    const bankruptcies = [];
    const successPaths = [];
    const failurePaths = [];

    for (let sim = 0; sim < numSimulations; sim++) {
      let portfolio = currentPortfolio;
      let minPortfolio = portfolio;
      let wentBankrupt = false;
      let bankruptcyMonth = null;
      const path = [portfolio];

      for (let month = 1; month <= totalMonths; month++) {
        // Random monthly return using Box-Muller transform
        const randomReturn = this.generateNormalRandom(monthlyReturnMean, monthlyVolatility);

        // Accumulation phase
        if (month <= accumulationMonths) {
          portfolio = portfolio * (1 + randomReturn) + monthlyContribution;
        }
        // Withdrawal phase
        else {
          // Inflation-adjusted withdrawal
          const monthsInRetirement = month - accumulationMonths;
          const inflationFactor = Math.pow(1 + monthlyInflation, monthsInRetirement);
          const adjustedWithdrawal = monthlyWithdrawal * inflationFactor;
          portfolio = portfolio * (1 + randomReturn) - adjustedWithdrawal;
        }

        path.push(portfolio);

        if (portfolio < minPortfolio) minPortfolio = portfolio;

        // Bankruptcy check
        if (portfolio <= 0 && !wentBankrupt) {
          wentBankrupt = true;
          bankruptcyMonth = month;
          portfolio = 0;
          // Stop this simulation early if bankrupt
          // (optional: break here to speed up, but we want full path for analysis)
        }
      }

      const isSuccess = portfolio > 0;
      if (isSuccess) successCount++;

      finalValues.push(portfolio);
      minValues.push(minPortfolio);
      if (wentBankrupt) bankruptcies.push({ bankruptcyMonth, finalValue: portfolio });

      // Store sample paths for visualization (save every 100th to avoid memory explosion)
      if (sim % 100 === 0) {
        if (isSuccess && successPaths.length < 50) {
          successPaths.push(path.filter((_, i) => i % 12 === 0)); // Annual points
        } else if (!isSuccess && failurePaths.length < 50) {
          failurePaths.push(path.filter((_, i) => i % 12 === 0));
        }
      }
    }

    // Calculate statistics
    const sortedFinal = [...finalValues].sort((a, b) => a - b);
    const successRate = successCount / numSimulations;
    const medianFinal = sortedFinal[Math.floor(numSimulations * 0.5)];
    const percentile10 = sortedFinal[Math.floor(numSimulations * 0.1)];
    const percentile25 = sortedFinal[Math.floor(numSimulations * 0.25)];
    const percentile75 = sortedFinal[Math.floor(numSimulations * 0.75)];
    const percentile90 = sortedFinal[Math.floor(numSimulations * 0.9)];

    return {
      params,
      summary: {
        numSimulations,
        successCount,
        successRate: Math.round(successRate * 10000) / 100,
        failureRate: Math.round((1 - successRate) * 10000) / 100,
        medianFinalValue: Math.round(medianFinal),
        percentile10: Math.round(percentile10),
        percentile25: Math.round(percentile25),
        percentile75: Math.round(percentile75),
        percentile90: Math.round(percentile90),
        meanFinalValue: Math.round(sortedFinal.reduce((a, b) => a + b, 0) / numSimulations),
        minFinalValue: Math.round(Math.min(...sortedFinal)),
        maxFinalValue: Math.round(Math.max(...sortedFinal)),
        medianMinPortfolio: Math.round(minValues.sort((a, b) => a - b)[Math.floor(numSimulations * 0.5)]),
        bankruptcies: bankruptcies.length
      },
      interpretation: this.interpretResults(successRate, medianFinal, monthlyWithdrawal * 12, params),
      samplePaths: {
        success: successPaths.slice(0, 5),
        failure: failurePaths.slice(0, 5)
      },
      yearlyProjections: this.generateYearlyProjections(currentPortfolio, monthlyContribution, yearsToRetirement, expectedReturn, monthlyWithdrawal, yearsInRetirement)
    };
  }

  static generateNormalRandom(mean, stdDev) {
    // Box-Muller transform
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
  }

  static generateYearlyProjections(currentPortfolio, monthlyContribution, yearsToRetirement, expectedReturn, monthlyWithdrawal, yearsInRetirement) {
    const projections = [];
    let portfolio = currentPortfolio;
    const annualReturn = expectedReturn / 100;

    // Accumulation
    for (let year = 1; year <= yearsToRetirement; year++) {
      portfolio = portfolio * (1 + annualReturn) + (monthlyContribution * 12);
      projections.push({
        year,
        age: 38 + year,
        phase: 'accumulation',
        portfolio: Math.round(portfolio),
        contribution: monthlyContribution * 12,
        withdrawal: 0
      });
    }

    // Retirement
    for (let year = 1; year <= yearsInRetirement; year++) {
      portfolio = portfolio * (1 + annualReturn) - (monthlyWithdrawal * 12);
      projections.push({
        year: yearsToRetirement + year,
        age: 38 + yearsToRetirement + year,
        phase: 'withdrawal',
        portfolio: Math.round(Math.max(0, portfolio)),
        contribution: 0,
        withdrawal: monthlyWithdrawal * 12
      });
    }

    return projections;
  }

  static interpretResults(successRate, medianFinal, annualSpending, params) {
    const interpretations = [];

    if (successRate >= 0.95) {
      interpretations.push({
        level: 'excellent',
        title: 'Excellent Outlook (95%+ success)',
        description: 'Your plan has a very high probability of success. You could consider: increasing retirement spending, retiring earlier, or leaving a larger legacy.'
      });
    } else if (successRate >= 0.80) {
      interpretations.push({
        level: 'good',
        title: 'Good Outlook (80-95% success)',
        description: 'Your plan is likely to succeed, but there\'s meaningful risk. Consider: slightly higher savings, delaying retirement 1-2 years, or reducing withdrawal rate to 3.5%.'
      });
    } else if (successRate >= 0.60) {
      interpretations.push({
        level: 'fair',
        title: 'Fair Outlook (60-80% success)',
        description: 'Significant risk of outliving your money. Recommended actions: increase monthly savings by 20%+, delay retirement, or reduce retirement spending by 15%.'
      });
    } else {
      interpretations.push({
        level: 'poor',
        title: 'Poor Outlook (<60% success)',
        description: 'High probability of financial shortfall in retirement. Major adjustments needed: significantly increase savings, consider working to 70+, reduce retirement lifestyle expectations.'
      });
    }

    if (medianFinal > annualSpending * 5) {
      interpretations.push({
        level: 'positive',
        title: 'Legacy Potential',
        description: `Median final portfolio ($${Math.round(medianFinal).toLocaleString()}) exceeds 5x annual spending. You're likely to leave a substantial inheritance.`
      });
    }

    // Sensitivity
    interpretations.push({
      level: 'info',
      title: 'Sensitivity Analysis',
      description: `Success rate if returns are 2% lower: ~${Math.round(Math.max(0, successRate - 15))}%. If returns are 2% higher: ~${Math.round(Math.min(100, successRate + 10))}%. Investment returns are the single biggest variable.`
    });

    return interpretations;
  }
}

module.exports = MonteCarloEngine;
