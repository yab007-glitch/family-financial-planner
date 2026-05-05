export interface GoalInput {
    targetAmount: number;
    currentAmount: number;
    deadline: string;
    expectedReturn: number;
}

export interface GoalPlan {
    monthlyContribution: number;
    totalContributed: number;
    totalGrowth: number;
    finalValue: number;
    isAchievable: boolean;
    percentFromTarget: number;
}

export function calculateGoalPlan(input: GoalInput): GoalPlan {
    const { targetAmount, currentAmount, deadline, expectedReturn } = input;
    const now = new Date();
    const end = new Date(deadline);
    
    let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
    if (months < 1) months = 1;

    const monthlyRate = expectedReturn / 100 / 12;
    const fvTarget = targetAmount;
    const pv = currentAmount;
    
    const fvFactor = Math.pow(1 + monthlyRate, months);
    
    let monthlyContribution = 0;
    if (monthlyRate === 0) {
        monthlyContribution = (fvTarget - pv) / months;
    } else {
        // PMT formula: (FV - PV * (1+r)^n) / (((1+r)^n - 1) / r)
        monthlyContribution = (fvTarget - pv * fvFactor) / ((fvFactor - 1) / monthlyRate);
    }

    monthlyContribution = Math.max(0, monthlyContribution);
    
    const totalContributed = pv + (monthlyContribution * months);
    const finalValue = (pv * fvFactor) + (monthlyContribution * ((fvFactor - 1) / monthlyRate));
    const totalGrowth = finalValue - totalContributed;

    return {
        monthlyContribution: Math.round(monthlyContribution * 100) / 100,
        totalContributed: Math.round(totalContributed * 100) / 100,
        totalGrowth: Math.round(totalGrowth * 100) / 100,
        finalValue: Math.round(finalValue * 100) / 100,
        isAchievable: monthlyContribution < (targetAmount / 12), // Rough heuristic
        percentFromTarget: Math.round((currentAmount / targetAmount) * 10000) / 100,
    };
}
