export interface Snapshot {
    date: string;
    value: number;
    contribution: number;
}

export function calculateCAGR(beginValue: number, endValue: number, years: number): number {
    if (beginValue <= 0 || years <= 0) return 0;
    return (Math.pow(endValue / beginValue, 1 / years) - 1) * 100;
}

export function calculateXIRR(snapshots: Snapshot[]): number {
    if (snapshots.length < 2) return 0;
    const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const cashFlows = sorted.map((s) => ({
        date: new Date(s.date),
        amount: -s.contribution,
    }));
    const last = sorted[sorted.length - 1];
    cashFlows.push({ date: new Date(last.date), amount: last.value });

    const guess = 0.1;
    let rate = guess;
    for (let i = 0; i < 100; i++) {
        const npv = cashFlows.reduce((sum, cf) => {
            const days = (cf.date.getTime() - cashFlows[0].date.getTime()) / (1000 * 60 * 60 * 24);
            return sum + cf.amount / Math.pow(1 + rate, days / 365);
        }, 0);
        const dNpv = cashFlows.reduce((sum, cf) => {
            const days = (cf.date.getTime() - cashFlows[0].date.getTime()) / (1000 * 60 * 60 * 24);
            return sum - (cf.amount * days / 365) / Math.pow(1 + rate, days / 365 + 1);
        }, 0);
        if (Math.abs(npv) < 0.0001) break;
        rate = rate - npv / (dNpv || 1);
        if (rate < -0.99) rate = -0.99;
    }
    return Math.round(rate * 10000) / 100;
}

export function calculateTimeWeightedReturn(snapshots: Snapshot[]): number {
    if (snapshots.length < 2) return 0;
    const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let cumulativeReturn = 1;
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const periodReturn = (curr.value - prev.value - curr.contribution) / (prev.value + curr.contribution);
        cumulativeReturn *= 1 + periodReturn;
    }
    const years = (new Date(sorted[sorted.length - 1].date).getTime() - new Date(sorted[0].date).getTime()) / (1000 * 60 * 60 * 24 * 365);
    return years > 0 ? (Math.pow(cumulativeReturn, 1 / years) - 1) * 100 : 0;
}
