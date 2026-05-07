// #18: Monte Carlo Engine with seeding support for reproducible results
export interface SimulationOptions {
    initialAmount: number;
    monthlyContribution: number;
    years: number;
    expectedReturn: number;
    volatility?: number;
    simulations?: number;
    seed?: number;
}

export interface SimulationResult {
    percentiles: Record<string, number>;
    successRate: number;
    medianEndValue: number;
    years: number;
    seed?: number;
}

export class MonteCarloEngine {
    // Simple mulberry32 seeded PRNG
    private static mulberry32(a: number) {
        return function() {
            let t = (a += 0x6D2B79F5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    private static getNormalRandom(randomFunc: () => number): number {
        let u = 0, v = 0;
        while (u === 0) u = randomFunc();
        while (v === 0) v = randomFunc();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    public static simulate(options: SimulationOptions): SimulationResult {
        const {
            initialAmount,
            monthlyContribution,
            years,
            expectedReturn,
            volatility = 15,
            simulations = 1000,
            seed = Math.floor(Math.random() * 1000000)
        } = options;

        const randomFunc = this.mulberry32(seed);
        const results: number[] = [];
        const monthlyReturn = expectedReturn / 100 / 12;
        const monthlyVolatility = (volatility / 100) / Math.sqrt(12);
        const months = years * 12;

        for (let i = 0; i < simulations; i++) {
            let balance = initialAmount;
            for (let m = 0; m < months; m++) {
                // Geometric Brownian Motion approximation
                const randomReturn = monthlyReturn + (monthlyVolatility * this.getNormalRandom(randomFunc));
                balance = balance * (1 + randomReturn) + monthlyContribution;
                if (balance < 0) balance = 0;
            }
            results.push(balance);
        }

        results.sort((a, b) => a - b);

        const getPercentile = (p: number) => results[Math.floor(results.length * p)];
        
        return {
            percentiles: {
                '10th': Math.round(getPercentile(0.1)),
                '25th': Math.round(getPercentile(0.25)),
                '50th': Math.round(getPercentile(0.5)),
                '75th': Math.round(getPercentile(0.75)),
                '90th': Math.round(getPercentile(0.9)),
            },
            medianEndValue: Math.round(getPercentile(0.5)),
            successRate: Math.round((results.filter(v => v > 0).length / simulations) * 100),
            years,
            seed
        };
    }
}
