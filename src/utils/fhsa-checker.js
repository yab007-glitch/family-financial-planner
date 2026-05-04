/**
 * FHSA (First Home Savings Account) Eligibility Checker
 * The best hybrid account: RRSP deduction + TFSA-like tax-free withdrawal
 */
class FHSAChecker {
  static checkEligibility(params) {
    const {
      age = 38,
      firstTimeHomeBuyer = true,
      yearsSinceHomeOwnership = null,
      spouseOwnedHome = false,
      hasFHSA = false,
      previousFHSABalance = 0,
      annualIncome = 80000,
      yearsToPurchase = 5,
      targetHomePrice = 400000,
      downPaymentPercent = 20,
      province = 'QC'
    } = params;

    const checks = {
      age: {
        eligible: age >= 18 && age <= 71,
        currentAge: age,
        minAge: 18,
        maxAge: 71,
        note: age > 40 ? '⚠️ Must open by December 31 of the year you turn 40' : '✅ Age eligible'
      },
      firstTimeBuyer: {
        eligible: firstTimeHomeBuyer,
        note: firstTimeHomeBuyer
          ? '✅ You have not owned a home in the current year or the preceding 4 calendar years'
          : '❌ Must not have owned a home in the current year or preceding 4 years',
        yearsSinceOwnership: yearsSinceHomeOwnership
      },
      spouseCheck: {
        note: spouseOwnedHome
          ? '⚠️ If your spouse owned a home in the last 4 years and you lived there, you may be ineligible'
          : '✅ No spouse home ownership concerns'
      },
      accountExists: {
        hasFHSA,
        previousBalance: previousFHSABalance,
        note: hasFHSA ? `Existing FHSA with $${previousFHSABalance.toLocaleString()}` : 'No existing FHSA'
      }
    };

    const isEligible = checks.age.eligible && checks.firstTimeBuyer.eligible;

    // Calculate FHSA contribution plan
    const annualLimit = 8000;
    const lifetimeLimit = 40000;
    const maxYearsToContribute = Math.min(yearsToPurchase, 5); // Can carry forward 1 year
    const maxPossibleContribution = Math.min(lifetimeLimit, annualLimit * maxYearsToContribute);
    const actualContribution = Math.min(maxPossibleContribution, annualLimit * yearsToPurchase);

    // Calculate tax deduction value
    const marginalRate = this.estimateMarginalRate(annualIncome, province);
    const taxDeductionValue = actualContribution * marginalRate;

    // Calculate growth to purchase
    const expectedReturn = 0.07; // 7% annual
    const futureValue = actualContribution * Math.pow(1 + expectedReturn, yearsToPurchase);

    // Down payment analysis
    const targetDownPayment = targetHomePrice * (downPaymentPercent / 100);
    const hbpMax = 60000; // Home Buyers Plan from RRSP
    const fhsaPlusHBP = Math.min(futureValue, targetDownPayment) + (targetDownPayment > futureValue ? hbpMax : 0);

    return {
      eligible: isEligible,
      eligibilityChecks: checks,
      reasons: this.getIneligibilityReasons(checks),
      contributionPlan: {
        annualLimit,
        lifetimeLimit,
        yearsToContribute: yearsToPurchase,
        maxPossibleContribution: Math.round(maxPossibleContribution),
        recommendedContribution: Math.round(actualContribution),
        canCarryForward: true,
        carryForwardNote: 'If you don\'t contribute the full $8,000 in a year, you can carry forward the unused portion (max $8,000 from prior year + $8,000 current year = $16,000 max in one year)'
      },
      taxBenefit: {
        marginalRate: Math.round(marginalRate * 10000) / 100,
        taxDeductionValue: Math.round(taxDeductionValue),
        combinedWithRRSP: 'FHSA + RRSP deductions both reduce taxable income in same year',
        optimalStrategy: `Contribute $${annualLimit.toLocaleString()}/year for ${yearsToPurchase} years = $${Math.round(actualContribution).toLocaleString()} total deduction worth ~$${Math.round(taxDeductionValue).toLocaleString()} in tax savings`
      },
      purchaseProjection: {
        targetHomePrice,
        targetDownPayment: Math.round(targetDownPayment),
        fhsaFutureValue: Math.round(futureValue),
        coversDownPayment: futureValue >= targetDownPayment,
        shortfall: Math.max(0, targetDownPayment - futureValue),
        hbpAvailable: targetDownPayment > futureValue ? hbpMax : 0,
        combinedAvailable: Math.round(Math.min(futureValue, targetDownPayment) + (targetDownPayment > futureValue ? hbpMax : 0)),
        note: futureValue >= targetDownPayment
          ? '🎉 FHSA alone covers your target down payment!'
          : `FHSA covers $${Math.round(futureValue).toLocaleString()}. Use RRSP HBP ($${hbpMax.toLocaleString()}) for remainder.`
      },
      vsAlternatives: {
        vsTFSA: 'TFSA: Tax-free but NO deduction. FHSA: Deduction + tax-free. FHSA wins for homebuyers.',
        vsRRSP: 'RRSP: Deduction but withdrawals are taxable (except HBP). FHSA: Deduction + tax-free withdrawal. FHSA wins for first home.',
        vsHBP: 'HBP requires repayment over 15 years. FHSA: No repayment required. FHSA is simpler.',
        bestStrategy: 'Use FHSA first for down payment, then RRSP HBP if needed, then TFSA for additional savings.'
      },
      timeline: this.buildTimeline(yearsToPurchase, annualLimit, previousFHSABalance),
      actionItems: [
        '1. Open FHSA before December 31 of the year you turn 40',
        '2. Contribute $8,000/year (or $16,000 if carrying forward)',
        '3. Claim deduction on tax return (Line 31285)',
        '4. Invest in growth assets (XEQT, VEQT) inside FHSA',
        '5. Withdraw tax-free when buying first home',
        '6. If home not purchased by age 71, transfer to RRSP (no tax impact) or withdraw (taxable)'
      ]
    };
  }

  static getIneligibilityReasons(checks) {
    const reasons = [];
    if (!checks.age.eligible) reasons.push(`Age ${checks.age.currentAge} not in range 18-71`);
    if (!checks.firstTimeBuyer.eligible) reasons.push('Not a first-time homebuyer (owned home in last 4 years)');
    return reasons;
  }

  static estimateMarginalRate(income, province) {
    if (province === 'QC') {
      if (income <= 51780) return 0.2753;
      if (income <= 55867) return 0.3179;
      if (income <= 103545) return 0.3292;
      if (income <= 111733) return 0.3787;
      if (income <= 126000) return 0.3953;
      if (income <= 173205) return 0.4130;
      if (income <= 246752) return 0.4475;
      return 0.5331;
    }
    // Simplified for other provinces
    if (income <= 55867) return 0.20;
    if (income <= 111733) return 0.36;
    if (income <= 173205) return 0.42;
    return 0.47;
  }

  static buildTimeline(years, annualLimit, startingBalance = 0) {
    const timeline = [];
    let balance = startingBalance;
    const rate = 0.07;

    for (let year = 1; year <= years; year++) {
      balance = balance * (1 + rate) + annualLimit;
      timeline.push({
        year,
        contribution: annualLimit,
        cumulativeContributions: annualLimit * year,
        projectedBalance: Math.round(balance),
        taxDeduction: Math.round(annualLimit * 0.3292), // Using typical QC rate
        availableForWithdrawal: year >= 1 ? Math.round(balance) : 0 // Can withdraw after holding 30 days
      });
    }

    return timeline;
  }

  /**
   * Compare all accounts for first-time homebuyer
   */
  static compareHomeBuyingAccounts(downPaymentNeeded, yearsToPurchase, annualIncome) {
    const marginalRate = this.estimateMarginalRate(annualIncome, 'QC');
    const fhsaAnnual = 8000;
    const fhsaMax = 40000;

    const accounts = [
      {
        name: 'FHSA',
        annualLimit: 8000,
        lifetimeLimit: 40000,
        taxDeduction: true,
        withdrawalTax: 0,
        repaymentRequired: false,
        maxPossible: Math.min(fhsaMax, fhsaAnnual * yearsToPurchase),
        taxValue: Math.min(fhsaMax, fhsaAnnual * yearsToPurchase) * marginalRate,
        bestFor: 'First-time homebuyers who want deduction + tax-free withdrawal'
      },
      {
        name: 'RRSP (HBP)',
        annualLimit: Math.min(annualIncome * 0.18, 32490),
        lifetimeLimit: null,
        taxDeduction: true,
        withdrawalTax: 0,
        repaymentRequired: true,
        repaymentYears: 15,
        maxPossible: 60000,
        taxValue: 0, // Already got deduction when contributed
        bestFor: 'Those who already have RRSP built up, need more than FHSA limit'
      },
      {
        name: 'TFSA',
        annualLimit: 7000,
        lifetimeLimit: null,
        taxDeduction: false,
        withdrawalTax: 0,
        repaymentRequired: false,
        maxPossible: 7000 * yearsToPurchase,
        taxValue: 0,
        bestFor: 'Flexibility — can use for home OR anything else. No deduction but no strings.'
      }
    ];

    const totalAvailable = accounts.reduce((sum, a) => sum + a.maxPossible, 0);
    const coversDownPayment = totalAvailable >= downPaymentNeeded;

    return {
      accounts,
      combinedMax: Math.min(totalAvailable, downPaymentNeeded),
      coversDownPayment,
      shortfall: Math.max(0, downPaymentNeeded - totalAvailable),
      recommendedOrder: ['FHSA', 'RRSP (HBP)', 'TFSA'],
      recommendation: coversDownPayment
        ? `Using all 3 accounts, you can raise $${totalAvailable.toLocaleString()} — enough for your $${downPaymentNeeded.toLocaleString()} down payment.`
        : `Maximum from all accounts: $${totalAvailable.toLocaleString()}. Shortfall: $${(downPaymentNeeded - totalAvailable).toLocaleString()}. Consider lower home price or longer timeline.`
    };
  }
}

module.exports = FHSAChecker;
