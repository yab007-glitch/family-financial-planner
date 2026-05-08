import queries from '../db/queries';

export interface ExchangeRate {
    base: string;
    quote: string;
    rate: number;
    updated_at: string;
}

export class CurrencyService {
    // In a production app, this would call an API like exchangerate-api.com
    public static async getRate(base: string, quote: string): Promise<number> {
        if (base === quote) return 1;
        
        // Try to get from cache first
        const cached = await queries.get<ExchangeRate>(
            'SELECT * FROM currency_rates WHERE base = ? AND quote = ?',
            [base, quote]
        );

        // If cache is fresh (within 24 hours), use it
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        if (cached && cached.updated_at > oneDayAgo) {
            return cached.rate;
        }

        // Mock external API call
        const mockRates: Record<string, number> = {
            'USD_CAD': 1.38,
            'CAD_USD': 0.72,
            'EUR_CAD': 1.48,
            'GBP_CAD': 1.75
        };

        const rate = mockRates[`${base}_${quote}`] || 1.0;
        
        // Update cache
        await queries.run(
            'INSERT OR REPLACE INTO currency_rates (base, quote, rate, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
            [base, quote, rate]
        );

        return rate;
    }

    public static async convert(amount: number, from: string, to: string = 'CAD'): Promise<number> {
        if (from === to) return amount;
        const rate = await this.getRate(from, to);
        return Math.round(amount * rate * 100) / 100;
    }
}
