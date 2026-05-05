/**
 * Retirement Income Simulator
 */
import { TaxEngine } from './taxEngine';

export interface RetirementParams {
    currentAge: number;
    retirementAge: number;
    lifespan: number;
    rrspBalanceAtRetirement: number;
    tfsaBalanceAtRetirement: number;
    nonRegisteredBalance: number;
    cppStartAge: number;
    oasStartAge: number;
    desiredIncome: number;
    spouseIncome: number;
    isSingle: boolean;
    inflation: number;
    investmentReturn: number;
}

export interface YearSimulation {
    age: number;
    targetIncome: number;
    cppReceived: number;
    oasReceived: number;
    oasClawback: number;
    gisReceived: number;
    guaranteedIncome: number;
    rrspWithdrawal: number;
    tfsaWithdrawal: number;
    nonRegWithdrawal: number;
    taxPaid: number;
    incomeShortfall: number;
    endingRRSP: number;
    endingTFSA: number;
    endingNonRegistered: number;
    totalAssets: number;
}

export class RetirementSimulator {
    private taxEngine: TaxEngine;

    private readonly OAS_MAX_MONTHLY = 727.67;
    private readonly OAS_MAX_MONTHLY_75PLUS = 800.44;
    private readonly OAS_CLAWBACK_THRESHOLD = 90797;
    private readonly OAS_CLAWBACK_RATE = 0.15;
    private readonly GIS_MAX_SINGLE = 1085.56;
    private readonly GIS_THRESHOLD_SINGLE = 21624;
    private readonly CPP_MAX_MONTHLY = 1433;

    constructor() {
        this.taxEngine = new TaxEngine(2025);
    }

    public simulateRetirement(params: RetirementParams) {
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
            investmentReturn = 5,
        } = params;

        if (currentAge < 0) throw new Error('Current age cannot be negative');
        if (retirementAge <= currentAge) throw new Error('Retirement age must be greater than current age');
        if (lifespan <= retirementAge) throw new Error('Lifespan must be greater than retirement age');

        const years: YearSimulation[] = [];
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
                age, rrsp, tfsa, nonReg, cppStartAge, oasStartAge, desiredIncome,
                spouseIncome, isSingle, inflation, investmentReturn
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
                yearsWithShortfall: years.filter(y => y.incomeShortfall > 0).length,
            },
            years,
            keyInsights: this.generateInsights(years, params),
        };
    }

    private simulateYear(input: any): YearSimulation {
        const { age, rrsp, tfsa, nonReg, cppStartAge, oasStartAge, desiredIncome, spouseIncome, isSingle, inflation, investmentReturn } = input;

        const yearsFromRetirement = age - 65;
        const inflationFactor = Math.pow(1 + (inflation / 100), Math.max(0, yearsFromRetirement));
        const targetIncome = desiredIncome * inflationFactor;

        let cppReceived = 0;
        if (age >= cppStartAge) {
            const cppReduction = cppStartAge < 65 ? 0.36 : (cppStartAge > 65 ? -0.42 : 0);
            const cppAdjustment = 1 - (cppReduction * Math.abs(65 - cppStartAge) / 12);
            cppReceived = this.CPP_MAX_MONTHLY * 12 * 0.7 * cppAdjustment;
        }

        let oasReceived = 0;
        let oasClawback = 0;
        if (age >= oasStartAge) {
            const baseOAS = age >= 75 ? this.OAS_MAX_MONTHLY_75PLUS : this.OAS_MAX_MONTHLY;
            const annualOAS = baseOAS * 12;

            if (targetIncome > this.OAS_CLAWBACK_THRESHOLD) {
                const excess = targetIncome - this.OAS_CLAWBACK_THRESHOLD;
                oasClawback = Math.min(annualOAS, excess * this.OAS_CLAWBACK_RATE);
            }
            oasReceived = Math.max(0, annualOAS - oasClawback);
        }

        let gisReceived = 0;
        if (age >= 65 && isSingle) {
            const incomeForGIS = targetIncome - oasReceived - cppReceived;
            if (incomeForGIS < this.GIS_THRESHOLD_SINGLE) {
                gisReceived = (this.GIS_MAX_SINGLE * 12) * (1 - incomeForGIS / this.GIS_THRESHOLD_SINGLE);
            }
        }

        const guaranteedIncome = cppReceived + oasReceived + gisReceived;
        const shortfall = Math.max(0, targetIncome - guaranteedIncome - (spouseIncome || 0));

        let currentRRSP = rrsp;
        let currentTFSA = tfsa;
        let currentNonReg = nonReg;

        let rrspWithdrawal = 0;
        let tfsaWithdrawal = 0;
        let nonRegWithdrawal = 0;

        if (shortfall > 0) {
            nonRegWithdrawal = Math.min(shortfall, currentNonReg);
            currentNonReg -= nonRegWithdrawal;
            let remaining = shortfall - nonRegWithdrawal;

            if (remaining > 0) {
                const marginalRate = this.taxEngine.getMarginalRate(targetIncome).combined;
                const grossUp = 1 / (1 - marginalRate);
                rrspWithdrawal = Math.min(remaining * grossUp, currentRRSP);
                currentRRSP -= rrspWithdrawal;
                remaining -= (rrspWithdrawal * (1 - marginalRate));
            }

            if (remaining > 0) {
                tfsaWithdrawal = Math.min(remaining, currentTFSA);
                currentTFSA -= tfsaWithdrawal;
                remaining -= tfsaWithdrawal;
            }
        }

        const taxableIncome = rrspWithdrawal + oasReceived + (cppReceived / 0.7);
        const marginalRate = this.taxEngine.getMarginalRate(taxableIncome).combined;
        const taxPaid = rrspWithdrawal * marginalRate;

        const endingRRSP = currentRRSP * (1 + investmentReturn / 100);
        const endingTFSA = currentTFSA * (1 + investmentReturn / 100);
        const endingNonRegistered = currentNonReg * (1 + (investmentReturn / 100) * 0.75);

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
            incomeShortfall: Math.round(Math.max(0, targetIncome - guaranteedIncome - (rrspWithdrawal + tfsaWithdrawal + nonRegWithdrawal))),
            endingRRSP: Math.round(endingRRSP),
            endingTFSA: Math.round(endingTFSA),
            endingNonRegistered: Math.round(endingNonRegistered),
            totalAssets: Math.round(endingRRSP + endingTFSA + endingNonRegistered)
        };
    }

    private generateInsights(years: YearSimulation[], _params: RetirementParams) {
        const insights: any[] = [];
        const firstShortfall = years.find(y => y.incomeShortfall > 100);

        if (firstShortfall) {
            insights.push({
                type: 'warning',
                severity: 'high',
                title: `Income Shortfall at Age ${firstShortfall.age}`,
                description: 'Your assets may be depleted before your projected lifespan. Consider increasing your target retirement fund or reducing desired income.'
            });
        }

        const totalTax = years.reduce((sum, y) => sum + y.taxPaid, 0);
        insights.push({
            type: 'info',
            severity: 'medium',
            title: 'Tax Efficiency',
            description: `You will pay approximately $${totalTax.toLocaleString()} in taxes throughout retirement. Maximizing TFSA can help reduce this.`
        });

        return insights;
    }

    public static checkReadiness(currentAge: number, desiredRetirementAge: number, currentSavings: number, monthlyContribution: number, expectedReturn: number) {
        const yearsToRetirement = desiredRetirementAge - currentAge;
        const monthlyRate = expectedReturn / 100 / 12;
        const months = yearsToRetirement * 12;
        const futureSavings = currentSavings * Math.pow(1 + expectedReturn / 100, yearsToRetirement);
        const futureContributions = monthlyRate === 0
            ? monthlyContribution * months
            : monthlyContribution * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
        const totalAtRetirement = futureSavings + futureContributions;
        const safeAnnualWithdrawal = totalAtRetirement * 0.04;

        return {
            yearsToRetirement,
            projectedSavings: Math.round(totalAtRetirement),
            safeAnnualIncome: Math.round(safeAnnualWithdrawal),
            safeMonthlyIncome: Math.round(safeAnnualWithdrawal / 12),
            ruleOf25: Math.round(totalAtRetirement / 25),
            onTrack: totalAtRetirement > (desiredRetirementAge - 65) * 50000,
            recommendation: totalAtRetirement < 1000000
                ? 'Increase contributions or delay retirement. Target $1M+ for comfortable retirement at 65.'
                : 'On track! Consider increasing TFSA proportion for tax flexibility in retirement.',
        };
    }
}

export default RetirementSimulator;
