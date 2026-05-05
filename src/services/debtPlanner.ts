export interface Debt {
    name: string;
    balance: number;
    interestRate: number;
    monthlyPayment: number;
}

export interface PayoffStep {
    month: number;
    totalPaid: number;
    remainingBalance: number;
}

export interface PayoffResult {
    name: string;
    totalInterest: number;
    monthsToPayoff: number;
    payoffDate: string;
    monthlySteps: PayoffStep[];
    firstPayoffOrder: string[];
}

function simulatePayoff(debts: Debt[], extraPayment: number, strategy: 'avalanche' | 'snowball'): PayoffResult {
    const sorted = [...debts].map((d) => ({ ...d, currentBalance: d.balance }));
    
    if (strategy === 'avalanche') {
        sorted.sort((a, b) => b.interestRate - a.interestRate);
    } else {
        sorted.sort((a, b) => a.balance - b.balance);
    }

    let month = 0;
    let totalInterest = 0;
    const monthlySteps: PayoffStep[] = [];
    const firstPayoffOrder: string[] = [];
    const maxMonths = 600; // 50 years max safety

    const initialTotalBalance = sorted.reduce((sum, d) => sum + d.balance, 0);

    while (sorted.some((d) => d.currentBalance > 0) && month < maxMonths) {
        month++;
        let availableExtra = extraPayment;

        for (const debt of sorted) {
            if (debt.currentBalance <= 0) continue;

            // Monthly interest
            const interest = (debt.currentBalance * debt.interestRate) / 100 / 12;
            totalInterest += interest;
            debt.currentBalance += interest;

            // Monthly payment
            let payment = debt.monthlyPayment;
            if (availableExtra > 0) {
                payment += availableExtra;
                availableExtra = 0;
            }

            payment = Math.min(payment, debt.currentBalance);
            debt.currentBalance -= payment;

            if (debt.currentBalance <= 0 && !firstPayoffOrder.includes(debt.name)) {
                firstPayoffOrder.push(debt.name);
                // When a debt is paid off, its minimum payment becomes extra for the next debt
                availableExtra += debt.monthlyPayment; 
            }
        }

        const totalRemaining = sorted.reduce((sum, d) => sum + Math.max(0, d.currentBalance), 0);
        monthlySteps.push({ 
            month, 
            totalPaid: initialTotalBalance + totalInterest - totalRemaining, 
            remainingBalance: totalRemaining 
        });
    }

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + month);

    return {
        name: strategy === 'avalanche' ? 'Debt Avalanche (highest rate first)' : 'Debt Snowball (smallest balance first)',
        totalInterest: Math.round(totalInterest),
        monthsToPayoff: month,
        payoffDate: payoffDate.toISOString().slice(0, 7),
        monthlySteps: monthlySteps.filter((_, i) => i % 6 === 0 || i === monthlySteps.length - 1),
        firstPayoffOrder,
    };
}

export function compareStrategies(debts: Debt[], extraPayment: number = 0) {
    const avalanche = simulatePayoff(debts, extraPayment, 'avalanche');
    const snowball = simulatePayoff(debts, extraPayment, 'snowball');
    
    const winner = avalanche.totalInterest <= snowball.totalInterest ? 'avalanche' : 'snowball';
    const interestSaved = Math.abs(avalanche.totalInterest - snowball.totalInterest);

    return {
        avalanche,
        snowball,
        winner,
        interestSaved: Math.round(interestSaved)
    };
}
