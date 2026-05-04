/**
 * Retirement Income Simulator
 * RRIF withdrawals, OAS, GIS, CPP/QPP, tax analysis
 */
const TaxEngine = require('./tax-engine');

class RetirementSimulator {
  constructor() {
    this.taxEngine = new TaxEngine(2025);
    // 2025 OAS/GIS parameters
    this.OAS_MAX_MONTHLY = 727.67; // Maximum monthly OAS (age 65-74)
    this.OAS_MAX_MONTHLY_75PLUS = 800.44; // 10% increase at 75+
    this.OAS_CLAWBACK_THRESHOLD = 90797; // Annual income threshold
    this.OAS_CLAWBACK_RATE = 0.15; // 15% of excess income
    this.GIS_MAX_SINGLE = 1085.56; // Monthly GIS max for single
    this.GIS_MAX_COUPLE = 1639.33; // Monthly GIS max for couple
    this.GIS_THRESHOLD_SINGLE = 21624; // Income threshold where GIS starts reducing
    this.CPP_MAX_MONTHLY = 1433; // Maximum CPP at 65
    this.QPP_MAX_MONTHLY = 1433; // QPP ~ same as CPP
  }

  /**
   * Simulate retirement from age 65 through death
   */
  simulateRetirement(params) {
    const {
      currentAge = 38,
      retirementAge = 65,
      lifespan = 90,
      rrspBalanceAtRetirement = 500000,
      tfsaBalanceAtRetirement = 500000,
      nonRegisteredBalance = 100000,
      cppStartAge = 65,
      oasStartAge = 65,
      desiredIncome = 60000,
      spouseIncome = 0,
      isSingle = false,
      inflation = 2,
      investmentReturn = 5
    } = params;

    const years = [];
    let age = retirementAge;
    let rrsp = rrspBalanceAtRetirement;
    let tfsa = tfsaBalanceAtRetirement;
    let nonReg = nonRegisteredBalance;
    let cumulativeTaxPaid = 0;
    let totalOASReceived = 0;
    let totalGISReceived = 0;
    let totalCPPReceived = 0;

    while (age <= lifespan) {
      const year = this.simulateYear({
        age,
        rrsp,
        tfsa,
        nonReg,
        cppStartAge,
        oasStartAge,
        desiredIncome,
        spouseIncome,
        isSingle,
        inflation,
        investmentReturn,
        cumulativeTaxPaid
      });

      years.push(year);
      rrsp = year.endingRRSP;
      tfsa = year.endingTFSA;
      nonReg = year.endingNonRegistered;
      cumulativeTaxPaid += year.taxPaid;
      totalOASReceived += year.oasReceived;
      totalGISReceived += year.gisReceived;
      totalCPPReceived += year.cppReceived;
      age++;
    }

    return {
      params,
      summary: {
        yearsSimulated: years.length,
        totalTaxPaid: Math.round(cumulativeTaxPaid),
        totalOASReceived: Math.round(totalOASReceived),
        totalGISReceived: Math.round(totalGISReceived),
        totalCPPReceived: Math.round(totalCPPReceived),
        finalRRSP: Math.round(rrsp),
        finalTFSA: Math.round(tfsa),
        finalNonRegistered: Math.round(nonReg),
        estateValue: Math.round(rrsp + tfsa + nonReg),
        yearsWithShortfall: years.filter(y => y.incomeShortfall > 0).length
      },
      years,
      keyInsights: this.generateInsights(years, params)
    };
  }

  simulateYear({ age, rrsp, tfsa, nonReg, cppStartAge, oasStartAge, desiredIncome,
                 spouseIncome, isSingle, inflation, investmentReturn, cumulativeTaxPaid }) {
    // Apply inflation adjustment to desired income
    const yearsFromRetirement = age - Math.max(65, cppStartAge);
    const inflationFactor = Math.pow(1 + inflation / 100, yearsFromRetirement);
    const targetIncome = desiredIncome * inflationFactor;

    // CPP/QPP (starts at cppStartAge)
    let cppReceived = 0;
    if (age >= cppStartAge) {
      const cppReduction = cppStartAge < 65 ? 0.36 : (cppStartAge > 65 ? 0.42 : 0); // Early/late penalties
      const cppMonthly = this.CPP_MAX_MONTHLY * (1 - cppReduction * Math.abs(65 - cppStartAge) / 12);
      cppReceived = cppMonthly * 12 * 0.7; // Assume 70% of max for average earner
    }

    // OAS (starts at oasStartAge, clawed back at high income)
    let oasReceived = 0;
    let oasClawback = 0;
    if (age >= oasStartAge) {
      const baseOAS = age >= 75 ? this.OAS_MAX_MONTHLY_75PLUS : this.OAS_MAX_MONTHLY;
      const annualOAS = baseOAS * 12;
      // Estimate income for clawback (simplified: use previous year's income)
      const estimatedIncome = targetIncome; // Simplified
      if (estimatedIncome > this.OAS_CLAWBACK_THRESHOLD) {
        const excess = estimatedIncome - this.OAS_CLAWBACK_THRESHOLD;
        oasClawback = Math.min(annualOAS, excess * this.OAS_CLAWBACK_RATE);
      }
      oasReceived = Math.max(0, annualOAS - oasClawback);
    }

    // GIS (Guaranteed Income Supplement)
    let gisReceived = 0;
    if (age >= 65 && !isSingle) { // Simplified: GIS primarily for low-income singles
      const incomeForGIS = targetIncome - oasReceived - cppReceived;
      if (incomeForGIS < this.GIS_THRESHOLD_SINGLE) {
        gisReceived = (this.GIS_MAX_SINGLE * 12) * (1 - incomeForGIS / this.GIS_THRESHOLD_SINGLE);
        gisReceived = Math.max(0, gisReceived);
      }
    }

    // Total guaranteed income
    const guaranteedIncome = cppReceived + oasReceived + gisReceived;
    const shortfall = Math.max(0, targetIncome - guaranteedIncome - spouseIncome);

    // Withdraw from accounts (smart ordering: non-reg first, RRSP next, TFSA last)
    let rrspWithdrawal = 0;
    let tfsaWithdrawal = 0;
    let nonRegWithdrawal = 0;
    let incomeShortfall = 0;

    if (shortfall > 0) {
      // 1. Withdraw from non-registered (already taxed)
      nonRegWithdrawal = Math.min(shortfall, nonReg);
      nonReg -= nonRegWithdrawal;
      let remaining = shortfall - nonRegWithdrawal;

      // 2. Withdraw from RRSP (taxable)
      if (remaining > 0) {
        // Gross up for tax (if you need $100 and tax rate is 30%, withdraw $143)
        const marginalRate = this.taxEngine.getMarginalRate(targetIncome).combined || 0.30;
        const grossUp = 1 / (1 - marginalRate);
        rrspWithdrawal = Math.min(remaining * grossUp, rrsp);
        rrsp -= rrspWithdrawal;
        remaining -= (rrspWithdrawal * (1 - marginalRate));
      }

      // 3. Withdraw from TFSA (tax-free)
      if (remaining > 0) {
        tfsaWithdrawal = Math.min(remaining, tfsa);
        tfsa -= tfsaWithdrawal;
        remaining -= tfsaWithdrawal;
      }

      incomeShortfall = remaining;
    }

    // Calculate tax on withdrawals
    const taxableIncome = rrspWithdrawal + (cppReceived * 0) + oasReceived + gisReceived;
    // Simplified tax calculation
    const marginalRate = this.taxEngine.getMarginalRate(taxableIncome).combined || 0.20;
    const taxPaid = rrspWithdrawal * marginalRate;

    // Growth on remaining balances
    rrsp = rrsp * (1 + investmentReturn / 100) - rrspWithdrawal;
    tfsa = tfsa * (1 + investmentReturn / 100) - tfsaWithdrawal;
    nonReg = nonReg * (1 + (investmentReturn / 100) * 0.7) - nonRegWithdrawal; // 70% of return after tax

    return {
      age,
      targetIncome: Math.round(targetIncome),
      cppReceived: Math.round(cppReceived),
      oasReceived: Math.round(oasReceived),
      oasClawback: Math.round(oasClawback),
      gisReceived: Math.round(gisReceived),
      guaranteedIncome: Math.round(guaranteedIncome),
      rrspWithdrawal: Math.round(rrspWithdrawal),
      tfsaWithdrawal: Math.round(tfsaWithdrawal),
      nonRegWithdrawal: Math.round(nonRegWithdrawal),
      taxPaid: Math.round(taxPaid),
      incomeShortfall: Math.round(incomeShortfall),
      endingRRSP: Math.round(Math.max(0, rrsp)),
      endingTFSA: Math.round(Math.max(0, tfsa)),
      endingNonRegistered: Math.round(Math.max(0, nonReg)),
      totalAssets: Math.round(Math.max(0, rrsp + tfsa + nonReg))
    };
  }

  generateInsights(years, params) {
    const insights = [];
    const firstShortfall = years.find(y => y.incomeShortfall > 0);
    const oasClawbackYears = years.filter(y => y.oasClawback > 0);
    const totalTax = years.reduce((a, b) => a + b.taxPaid, 0);
    const rrspDepletedAge = years.find(y => y.endingRRSP <= 0)?.age;
    const tfsaDepletedAge = years.find(y => y.endingTFSA <= 0)?.age;

    // RRSP vs TFSA insight
    if (years[0].rrspWithdrawal > 0 && years[0].tfsaWithdrawal === 0) {
      insights.push({
        type: 'strategy',
        severity: 'info',
        title: 'Withdrawal Order: Non-registered > RRSP > TFSA',
        description: 'Your simulation withdraws from taxable accounts first, preserving TFSA for tax-free growth. Consider reversing if you expect higher taxes later.'
      });
    }

    if (firstShortfall) {
      insights.push({
        type: 'warning',
        severity: 'high',
        title: `Income Shortfall Starting at Age ${firstShortfall.age}`,
        description: `Your retirement savings may not sustain your desired income. Consider: increasing savings, delaying retirement to ${params.retirementAge + 2}, or reducing desired income by 10-15%.`,
        action: 'Go to Goals page and adjust retirement target'
      });
    }

    if (oasClawbackYears.length > 0) {
      const totalClawback = oasClawbackYears.reduce((a, b) => a + b.oasClawback, 0);
      insights.push({
        type: 'tax',
        severity: 'medium',
        title: `OAS Clawback: $${Math.round(totalClawback).toLocaleString()} Lost`,
        description: 'Your income exceeds the OAS threshold ($90,797). Consider drawing more from TFSA (non-taxable) and less from RRSP to reduce clawback.',
        action: 'Use TFSA more, RRSP less in retirement'
      });
    }

    if (rrspDepletedAge) {
      insights.push({
        type: 'warning',
        severity: 'medium',
        title: `RRSP Depleted at Age ${rrspDepletedAge}`,
        description: 'Your RRSP runs out early. If this is before age 90, ensure TFSA and other assets can cover remaining years.',
        action: 'Consider higher RRSP contributions now or delaying retirement'
      });
    }

    if (params.cppStartAge < 65) {
      insights.push({
        type: 'strategy',
        severity: 'info',
        title: 'CPP Early Take: Permanent Reduction',
        description: `Taking CPP at ${params.cppStartAge} means a ${((65 - params.cppStartAge) * 0.6).toFixed(1)}% permanent reduction. Break-even is ~age 74. If you live longer, waiting to 65+ pays more.`,
        action: 'Consider delaying CPP to 65 or 70 if health/longevity is good'
      });
    }

    if (params.cppStartAge === 70) {
      insights.push({
        type: 'strategy',
        severity: 'positive',
        title: 'CPP at 70: Maximum Benefit',
        description: 'Delaying CPP to 70 gives you 42% more than at 65. This is an excellent longevity hedge.',
        action: 'Use RRSP/TFSA to bridge 65-70 gap, then higher CPP kicks in'
      });
    }

    insights.push({
      type: 'tax',
      severity: 'info',
      title: `Total Tax Paid in Retirement: $${Math.round(totalTax).toLocaleString()}`,
      description: 'Taxes in retirement are often lower than working years, but RRSP withdrawals are fully taxable. TFSA withdrawals are tax-free and do not affect OAS/GIS.',
      action: 'Maximize TFSA before retirement to minimize tax drag'
    });

    return insights;
  }

  /**
   * Quick retirement readiness check
   */
  static checkReadiness(currentAge, desiredRetirementAge, currentSavings, monthlyContribution, expectedReturn) {
    const yearsToRetirement = desiredRetirementAge - currentAge;
    const monthlyRate = expectedReturn / 100 / 12;
    const months = yearsToRetirement * 12;

    // Future value of current savings
    const futureSavings = currentSavings * Math.pow(1 + expectedReturn / 100, yearsToRetirement);

    // Future value of contributions
    const futureContributions = monthlyContribution * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;

    const totalAtRetirement = futureSavings + futureContributions;

    // Rule of 25: need 25x annual expenses
    const safeAnnualWithdrawal = totalAtRetirement * 0.04; // 4% rule

    return {
      yearsToRetirement,
      projectedSavings: Math.round(totalAtRetirement),
      safeAnnualIncome: Math.round(safeAnnualWithdrawal),
      safeMonthlyIncome: Math.round(safeAnnualWithdrawal / 12),
      ruleOf25: Math.round(totalAtRetirement / 25),
      onTrack: totalAtRetirement > (desiredRetirementAge - 65) * 50000, // Rough heuristic
      recommendation: totalAtRetirement < 1000000
        ? 'Increase contributions or delay retirement. Target $1M+ for comfortable retirement at 65.'
        : 'On track! Consider increasing TFSA proportion for tax flexibility in retirement.'
    };
  }
}

module.exports = RetirementSimulator;
