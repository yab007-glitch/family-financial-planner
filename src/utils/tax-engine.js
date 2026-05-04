/**
 * Canadian Tax Engine - Federal + Quebec (2025)
 */

const FEDERAL_BRACKETS_2025 = [
  { limit: 55867, rate: 0.15 },
  { limit: 111733, rate: 0.205 },
  { limit: 173205, rate: 0.26 },
  { limit: 246752, rate: 0.29 },
  { limit: Infinity, rate: 0.33 }
];

const QUEBEC_BRACKETS_2025 = [
  { limit: 51780, rate: 0.14 },
  { limit: 103545, rate: 0.19 },
  { limit: 126000, rate: 0.24 },
  { limit: Infinity, rate: 0.2575 }
];

const FEDERAL_BPA_2025 = 16129;
const QUEBEC_BPA_2025 = 17183;
const RRSP_MAX_CONTRIBUTION_2025 = 32490;
const TFSA_2025_LIMIT = 7000;
const RESP_CESG_MATCH_RATE = 0.20;
const RESP_CESG_MAX_ANNUAL = 500;

class TaxEngine {
  constructor(year = 2025) {
    this.year = year;
    this.federalBrackets = FEDERAL_BRACKETS_2025;
    this.quebecBrackets = QUEBEC_BRACKETS_2025;
  }

  calculateFederalTax(taxableIncome) {
    let tax = 0, remaining = taxableIncome, previousLimit = 0;
    for (const bracket of this.federalBrackets) {
      if (remaining <= 0) break;
      const taxableInBracket = Math.min(remaining, bracket.limit - previousLimit);
      tax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
      previousLimit = bracket.limit;
    }
    return Math.round(tax * 100) / 100;
  }

  calculateQuebecTax(taxableIncome) {
    let tax = 0, remaining = taxableIncome, previousLimit = 0;
    for (const bracket of this.quebecBrackets) {
      if (remaining <= 0) break;
      const taxableInBracket = Math.min(remaining, bracket.limit - previousLimit);
      tax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
      previousLimit = bracket.limit;
    }
    return Math.round(tax * 100) / 100;
  }

  getMarginalRate(income) {
    let fedRate = 0.15;
    for (const bracket of this.federalBrackets) {
      if (income <= bracket.limit) { fedRate = bracket.rate; break; }
    }
    let qcRate = 0.14;
    for (const bracket of this.quebecBrackets) {
      if (income <= bracket.limit) { qcRate = bracket.rate; break; }
    }
    const combined = this.mapToKnownCombinedRate(income);
    return { income, federal: fedRate, quebec: qcRate, combined: combined.rate, bracket: combined.bracket };
  }

  mapToKnownCombinedRate(income) {
    if (income <= 51780) return { rate: 0.2753, bracket: '$0 - $51,780' };
    if (income <= 55867) return { rate: 0.3179, bracket: '$51,781 - $55,867' };
    if (income <= 103545) return { rate: 0.3292, bracket: '$55,868 - $103,545' };
    if (income <= 111733) return { rate: 0.3787, bracket: '$103,546 - $111,733' };
    if (income <= 126000) return { rate: 0.3953, bracket: '$111,734 - $126,000' };
    if (income <= 173205) return { rate: 0.4130, bracket: '$126,001 - $173,205' };
    if (income <= 246752) return { rate: 0.4475, bracket: '$173,206 - $246,752' };
    return { rate: 0.5331, bracket: '$246,753+' };
  }

  calculateRRSPImpact(income, rrspContribution) {
    const taxableAfter = Math.max(0, income - rrspContribution);
    const fedBefore = this.calculateFederalTax(income);
    const fedAfter = this.calculateFederalTax(taxableAfter);
    const qcBefore = this.calculateQuebecTax(income);
    const qcAfter = this.calculateQuebecTax(taxableAfter);
    const taxRefund = (fedBefore + qcBefore) - (fedAfter + qcAfter);
    const effectiveRate = rrspContribution > 0 ? (taxRefund / rrspContribution) : 0;

    return { contribution: rrspContribution, taxRefund, effectiveRate: Math.round(effectiveRate * 10000) / 100 };
  }

  calculateFullTaxReturn(grossIncome, rrspContribution = 0) {
    const taxableIncome = Math.max(0, grossIncome - rrspContribution);
    const federalTax = this.calculateFederalTax(taxableIncome);
    const quebecTax = this.calculateQuebecTax(taxableIncome);
    const federalBPCredit = FEDERAL_BPA_2025 * 0.15;
    const quebecBPCredit = QUEBEC_BPA_2025 * 0.14;
    const qpp = Math.max(0, Math.min(grossIncome, 71300) - 3500) * 0.06;
    const ei = Math.min(grossIncome, 65700) * 0.0164;
    const qpip = Math.min(grossIncome, 97600) * 0.00494;
    const netFederalTax = Math.max(0, federalTax - federalBPCredit);
    const netQuebecTax = Math.max(0, quebecTax - quebecBPCredit);
    const totalTax = netFederalTax + netQuebecTax + qpp + ei + qpip;
    const marginalRate = this.getMarginalRate(taxableIncome).combined;
    const rrspImpact = this.calculateRRSPImpact(grossIncome, rrspContribution);

    return {
      grossIncome,
      rrspContribution,
      taxableIncome,
      federalTax: Math.round(federalTax),
      quebecTax: Math.round(quebecTax),
      netFederalTax: Math.round(netFederalTax),
      netQuebecTax: Math.round(netQuebecTax),
      payrollDeductions: { qpp: Math.round(qpp * 100) / 100, ei: Math.round(ei * 100) / 100, qpip: Math.round(qpip * 100) / 100, total: Math.round((qpp + ei + qpip) * 100) / 100 },
      totalTax: Math.round(totalTax),
      afterTaxIncome: Math.round(grossIncome - totalTax),
      averageTaxRate: Math.round((totalTax / grossIncome) * 10000) / 100,
      marginalTaxRate: marginalRate,
      rrspRefund: Math.round(rrspImpact.taxRefund),
      rrspEffectiveRate: rrspImpact.effectiveRate
    };
  }

  calculateResCESG(contribution, numChildren = 1) {
    const eligibleForMatch = Math.min(contribution, 2500 * numChildren);
    const annualGrant = Math.min(eligibleForMatch * RESP_CESG_MATCH_RATE, RESP_CESG_MAX_ANNUAL * numChildren);
    return { contribution, eligibleForMatch, annualGrant: Math.round(annualGrant), grantRate: RESP_CESG_MATCH_RATE, maxAnnualPerChild: RESP_CESG_MAX_ANNUAL, recommendation: `Contribute $${(2500 * numChildren).toLocaleString()}/year to get full $${(RESP_CESG_MAX_ANNUAL * numChildren).toLocaleString()} CESG grant` };
  }

  getOptimalSavingsOrder(income, age, numChildren) {
    const marginal = this.getMarginalRate(income).combined;
    const strategy = [];

    if (numChildren > 0) {
      strategy.push({ priority: 1, account: 'RESP', reason: 'Free 20% CESG match is guaranteed ROI. Maximize before children turn 17.' });
    }

    if (marginal < 0.30) {
      strategy.push({ priority: 2, account: 'TFSA', reason: `Marginal rate ${(marginal*100).toFixed(1)}% < 30%. Use TFSA now, switch to RRSP later when income grows.` });
      strategy.push({ priority: 3, account: 'RRSP (deferred deduction)', reason: 'Contribute now for tax-deferred growth, but SAVE the deduction for a higher income year for bigger refund.' });
    } else {
      strategy.push({ priority: 2, account: 'RRSP', reason: `Marginal rate ${(marginal*100).toFixed(1)}% > 30%. Every $1,000 = $${(marginal*1000).toFixed(0)} tax refund. Reinvest refund for double wealth building.` });
      strategy.push({ priority: 3, account: 'TFSA', reason: 'After RRSP room exhausted, use TFSA for additional tax-free growth.' });
    }

    if (age >= 18) {
      strategy.push({ priority: 4, account: 'FHSA', reason: 'Best of both worlds: tax deduction + tax-free withdrawal for first home. Must open by Dec 31 of year you turn 40.' });
    }

    strategy.push({ priority: 5, account: 'Spousal RRSP', reason: 'If spouse earns less, you contribute and they withdraw in retirement at lower tax rate.' });
    strategy.push({ priority: 6, account: 'Non-registered (Tax-efficient ETFs)', reason: 'Horizons swap ETFs (HXS, HXT) defer capital gains. Or XEQT for simplicity. Only after all registered accounts maxed.' });

    return strategy;
  }
}

module.exports = TaxEngine;
