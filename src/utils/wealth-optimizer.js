/**
 * Canadian Wealth Optimizer
 * Recommends the optimal order of contributions to maximize tax efficiency
 */
const TaxEngine = require('./tax-engine');

class WealthOptimizer {
  constructor(income, age, province = 'QC', numChildren = 0, childrenAges = []) {
    this.income = income;
    this.age = age;
    this.province = province;
    this.numChildren = numChildren;
    this.childrenAges = childrenAges;
    this.taxEngine = new TaxEngine(2025);
    this.marginalRate = this.taxEngine.getMarginalRate(income).combined;
  }

  /** ==========================================
   *  WEALTH BUILDING HIERARCHY (2025)
   *  ==========================================
   *  1. Employer Pension Match (free money)
   *  2. RESP ($2,500/child → $500 CESG)
   *  3. TFSA to Max ($7,000 + accumulated room)
   *  4. RRSP (depends on marginal tax rate vs expected retirement rate)
   *  5. FHSA ($8,000/year, max $40,000)
   *  6. Non-registered / Mortgage prepayment
   */ 

  /**
   * Determine optimal savings strategy
   */
  getOptimalStrategy(availableCash) {
    const recommendations = [];
    const taxInfo = this.taxEngine.calculateFullTaxReturn(this.income);
    const marginalRate = this.marginalRate;

    // Priority 1: RESP if you have kids under 17
    if (this.numChildren > 0 && this.childrenAges.some(a => a < 17)) {
      const maxRespPerChild = 2500;
      const totalResp = Math.min(availableCash, maxRespPerChild * this.numChildren);
      const cesg = this.taxEngine.calculateResCESG(totalResp, this.numChildren);
      
      recommendations.push({
        priority: 1,
        account: 'RESP',
        action: `Contribute $${totalResp.toLocaleString()} to RESP`,
        reason: `${this.numChildren} child(ren) eligible for CESG. Immediate 20% return on first $${(2500 * this.numChildren).toLocaleString()} = $${cesg.annualGrant.toLocaleString()} free government money.`,
        amount: totalResp,
        benefit: cesg.annualGrant,
        returnOnInvestment: 'Immediate 20% (government grant) + tax-deferred growth',
        urgency: 'CRITICAL - Children age out at 17',
        annualLimit: 2500 * this.numChildren,
        lifetimeLimit: null
      });
    }

    // Priority 2: TFSA (for flexibility and if marginal rate is low)
    // Rule: If marginal rate < 30%, prioritize TFSA over RRSP
    const tfsaRoom = this.getTFSARoom();
    if (marginalRate < 0.30) {
      recommendations.push({
        priority: 2,
        account: 'TFSA',
        action: `Max TFSA: $${Math.min(availableCash, tfsaRoom).toLocaleString()}`,
        reason: `Your marginal tax rate is ${(marginalRate * 100).toFixed(1)}% (< 30%). TFSA withdrawals are tax-free, no forced withdrawals at 71, won't affect OAS/GIS clawbacks.`,
        amount: Math.min(availableCash, tfsaRoom),
        benefit: 'Tax-free growth forever, flexibility',
        returnOnInvestment: 'Tax-free compound growth. If invested at 7% for 27 years: ~$488K from $78K room',
        urgency: 'HIGH - Use it or lose it (carryforward available, but time value of money)',
        annualLimit: 7000,
        cumulativeRoom: tfsaRoom
      });
    } else {
      // High earner: RRSP first
      recommendations.push({
        priority: 2,
        account: 'RRSP',
        action: `Max RRSP: $${Math.min(availableCash, taxInfo.rrspContribution).toLocaleString()}`,
        reason: `Your marginal rate is ${(marginalRate * 100).toFixed(1)}%. Every $1,000 RRSP = $${(marginalRate * 1000).toFixed(0)} tax refund. Reinvest refund for double benefit.`,
        amount: Math.min(availableCash, taxInfo.rrspContribution || 32490),
        benefit: `Tax refund of $${(Math.min(availableCash, taxInfo.rrspContribution || 32490) * marginalRate).toFixed(0)}`,
        returnOnInvestment: `${(marginalRate * 100).toFixed(1)}% immediate return via tax refund + tax-deferred growth`,
        urgency: 'HIGH - Tax shield on high income',
        annualLimit: taxInfo.rrspContribution || 32490,
        reinvestRefund: true
      });
    }

    // Priority 3: FHSA (if saving for first home)
    if (this.age >= 18 && this.age <= 71) {
      recommendations.push({
        priority: 3,
        account: 'FHSA',
        action: `Contribute $${Math.min(8000, availableCash).toLocaleString()} to FHSA`,
        reason: 'FHSA is the ultimate hybrid: RRSP-like tax deduction + TFSA-like tax-free withdrawal for first home.',
        amount: Math.min(8000, availableCash),
        benefit: `Tax deduction worth $${(Math.min(8000, availableCash) * marginalRate).toFixed(0)} + tax-free growth`,
        returnOnInvestment: `${(marginalRate * 100).toFixed(1)}% tax deduction + tax-free withdrawal for home purchase`,
        urgency: 'HIGH for first-time homebuyers',
        annualLimit: 8000,
        lifetimeLimit: 40000,
        caveat: 'Must not have owned home in past 4 years'
      });
    }

    // Priority 4: RRSP for low earners (after TFSA maxed)
    if (marginalRate < 0.30 && availableCash > tfsaRoom) {
      recommendations.push({
        priority: 4,
        account: 'RRSP (deferred)',
        action: `Contribute to RRSP up to limit: $${Math.min(availableCash - tfsaRoom, 32490).toLocaleString()}`,
        reason: `Defer deductions until income increases. Claim RRSP contributions but DON'T claim deduction yet. Carry forward to a higher-earning year for bigger refund.`,
        amount: Math.min(availableCash - tfsaRoom, 32490),
        benefit: 'Preserve deduction for higher income year',
        strategy: 'Contribute now (get tax-deferred growth), claim deduction later when income is higher',
        urgency: 'MEDIUM - Contribute now, claim later for maximum refund'
      });
    }

    // Priority 5: Spousal RRSP (if spouse in lower tax bracket)
    recommendations.push({
      priority: 5,
      account: 'Spousal RRSP',
      action: 'Consider if spouse/partner has lower income',
      reason: 'High-earning spouse contributes, lower-earning spouse withdraws in retirement. Spreads income, reduces average tax rate.',
      strategy: 'You contribute → Spouse owns → Spouse withdraws at lower tax rate in retirement',
      urgency: 'MEDIUM - Income splitting strategy'
    });

    // Priority 6: Non-registered / Mortgage
    recommendations.push({
      priority: 6,
      account: 'Non-registered / Mortgage',
      action: 'Invest in taxable account OR pay down mortgage',
      reason: `If mortgage rate > expected investment return after tax, prepay mortgage. If investment return > mortgage rate + tax drag, invest in non-registered with tax-efficient ETFs (Horizons swap, XEQT).`,
      comparison: 'Compare mortgage interest rate vs expected after-tax portfolio return',
      urgency: 'LOW - After all tax-advantaged accounts are maxed'
    });

    return {
      income: this.income,
      marginalRate: marginalRate,
      taxInfo,
      recommendations
    };
  }

  getTFSARoom() {
    // For someone who landed in QC in Sep 2015, room accumulated from 2015
    // 2015: $10,000 (special year)
    // 2016-2018: $5,500/year = $16,500
    // 2019-2022: $6,000/year = $24,000
    // 2023: $6,500
    // 2024: $7,000
    // 2025: $7,000
    // From 2015 to 2025 = $71,000
    // For someone who landed mid-year, they get the full calendar year amount
    return 71000; // Simplified; can be calculated precisely
  }

  /**
   * Quebec-specific credits and benefits
   */
  calculateQuebecCredits(familyIncome, numChildren, isSingleParent, rentPaid = 0, propertyTax = 0) {
    const credits = [];

    // Solidarity Tax Credit
    if (familyIncome < 58000) {
      let baseAmount = 0;
      if (numChildren === 0) baseAmount = isSingleParent ? 1123 : 1452;
      else baseAmount = isSingleParent ? 1452 : 1781;
      credits.push({
        name: 'Solidarity Tax Credit',
        amount: baseAmount,
        eligible: true,
        note: 'Quarterly payments for low/moderate income families'
      });
    }

    // Child Care Expenses Tax Credit
    if (numChildren > 0) {
      const maxChildCare = numChildren <= 2 ? 9000 : 15000;
      const qcRate = 0.30; // approximate effective rate
      credits.push({
        name: 'Quebec Child Care Expenses Credit',
        maxExpense: maxChildCare,
        taxCreditValue: Math.round(maxChildCare * qcRate),
        eligible: true,
        note: 'Daycare, camps, before/after school programs'
      });
    }

    // Work Premium (Quebec)
    if (familyIncome < 60000) {
      credits.push({
        name: 'Quebec Work Premium',
        amount: 'Up to $2,400/year',
        eligible: true,
        note: 'For working individuals and families with low income'
      });
    }

    // GST/HST Credit (Federal)
    if (familyIncome < 55000) {
      credits.push({
        name: 'GST/HST Credit',
        amount: 'Up to $1,200/year',
        eligible: true,
        note: 'Quarterly payments'
      });
    }

    // Climate Action Incentive Payment (CAIP)
    credits.push({
      name: 'Climate Action Incentive Payment',
      amount: '$400-$1,200/year',
      eligible: true,
      note: 'Federal rebate for households in applicable provinces'
    });

    // Canada Child Benefit
    if (numChildren > 0) {
      const ccb = this.taxEngine.calculateCCB(familyIncome, numChildren, this.childrenAges);
      credits.push({
        name: 'Canada Child Benefit (CCB)',
        monthlyAmount: ccb.monthlyBenefit,
        annualAmount: ccb.annualBenefit,
        eligible: ccb.annualBenefit > 0,
        note: 'Tax-free monthly benefit'
      });
    }

    // Quebec Child Assistance
    if (numChildren > 0 && familyIncome < 100000) {
      credits.push({
        name: 'Quebec Child Assistance (QCA)',
        amount: 'Up to $2,755/year per child',
        eligible: true,
        note: 'Combined with CCB for maximum child support'
      });
    }

    // Medical Expense Tax Credit
    credits.push({
      name: 'Medical Expense Tax Credit',
      eligible: true,
      note: 'Expenses over lesser of $2,635 or 3% of net income'
    });

    // Donation Tax Credit
    const donationThreshold = 200;
    credits.push({
      name: 'Donation Tax Credit',
      federalRate: '15% on first $200, 29%/33% above',
      quebecRate: '20% on first $200, 24-25.75% above',
      eligible: true,
      note: 'Combine spouse donations on one return for maximum benefit'
    });

    return credits;
  }

  /**
   * Complete wealth building roadmap for a family
   */
  getWealthRoadmap(availableCash, goals = {}) {
    const strategy = this.getOptimalStrategy(availableCash);
    const credits = this.calculateQuebecCredits(
      this.income,
      this.numChildren,
      goals.isSingleParent,
      goals.rentPaid,
      goals.propertyTax
    );

    return {
      familyProfile: {
        income: this.income,
        age: this.age,
        province: this.province,
        numChildren: this.numChildren,
        marginalTaxRate: strategy.marginalRate
      },
      availableCash,
      optimalStrategy: strategy.recommendations,
      eligibleCredits: credits.filter(c => c.eligible),
      totalEstimatedBenefits: credits.reduce((sum, c) => {
        if (c.annualAmount) return sum + c.annualAmount;
        if (c.monthlyAmount) return sum + (c.monthlyAmount * 12);
        if (c.amount && typeof c.amount === 'number') return sum + c.amount;
        return sum;
      }, 0),
      keyRules: [
        'Rule 1: Always take government matching money first (CESG, employer match)',
        'Rule 2: If marginal rate < 30%, prioritize TFSA',
        'Rule 3: If marginal rate > 30%, prioritize RRSP for refund, reinvest refund',
        'Rule 4: FHSA is the best hybrid for first-time homebuyers',
        'Rule 5: Contribute to RRSP early, claim deduction later if income will increase',
        'Rule 6: Spousal RRSP for income splitting in retirement',
        'Rule 7: Non-registered last, use tax-efficient ETFs (Horizons, XEQT)',
        'Rule 8: All tax refunds should be reinvested, not spent (wealth multiplier)',
        'Rule 9: RESPs: Maximize before child turns 17. CESG = free 20% ROI',
        `Rule 10: Quebec residents: Combine federal + provincial credits. Effective marginal rate at $${this.income.toLocaleString()} is ${(strategy.marginalRate * 100).toFixed(1)}%`
      ],
      yearOnePlan: this.buildYearOnePlan(strategy.recommendations, availableCash)
    };
  }

  buildYearOnePlan(recommendations, availableCash) {
    let remaining = availableCash;
    const plan = [];

    for (const rec of recommendations.sort((a, b) => a.priority - b.priority)) {
      if (remaining <= 0) break;
      if (rec.amount) {
        const allocation = Math.min(rec.amount, remaining);
        if (allocation > 0) {
          plan.push({
            step: rec.priority,
            account: rec.account,
            amount: allocation,
            benefit: rec.benefit,
            remainingCash: remaining - allocation
          });
          remaining -= allocation;
        }
      }
    }

    if (remaining > 0) {
      plan.push({
        step: 99,
        account: '<https://en.wikipedia.org/wiki/Cowboy_Mouth_(play)>Overflow',
        amount: remaining,
        note: 'Invest in non-registered account or prepay mortgage'
      });
    }

    return plan;
  }
}

module.exports = WealthOptimizer;
