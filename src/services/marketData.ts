import { Account } from '../types';
import queries from '../db/queries';

export class MarketDataService {
    // In a real app, this would call Alpha Vantage or Yahoo Finance
    private static async fetchPrice(symbol: string): Promise<number | null> {
        // Mock data logic for common Canadian ETFs and stocks
        const mockPrices: Record<string, number> = {
            'XEQT': 33.45,
            'VEQT': 41.12,
            'VGRO': 35.80,
            'TD.TO': 83.20,
            'RY.TO': 145.50,
            'SHOP.TO': 105.30,
            'BTC': 95000,
            'ETH': 3500
        };

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const price = mockPrices[symbol.toUpperCase()];
        return price || (Math.random() * 100 + 10); // Generic fallback for unknown symbols
    }

    public static async syncFamilyAccounts(familyId: number): Promise<{ updated: number }> {
        const accounts = await queries.all<Account>(
            'SELECT * FROM accounts WHERE family_id = ? AND symbol IS NOT NULL',
            [familyId]
        );

        let updated = 0;
        for (const account of accounts) {
            if (!account.symbol) continue;
            
            const price = await this.fetchPrice(account.symbol);
            if (price) {
                const newBalance = (account.units || 0) * price;
                await queries.run(
                    'UPDATE accounts SET balance = ?, last_price = ?, last_price_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [newBalance, price, account.id]
                );
                updated++;
            }
        }
        return { updated };
    }
}
