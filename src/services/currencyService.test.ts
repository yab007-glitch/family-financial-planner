import { describe, it, expect, vi } from 'vitest';
import { CurrencyService } from './currencyService';
import queries from '../db/queries';

vi.mock('../db/queries', () => ({
    default: {
        get: vi.fn(),
        run: vi.fn()
    }
}));

describe('CurrencyService', () => {
    it('returns 1 for same base and quote', async () => {
        const rate = await CurrencyService.getRate('CAD', 'CAD');
        expect(rate).toBe(1);
    });

    it('returns 1.38 for USD_CAD from mock rates when cache is empty', async () => {
        (queries.get as any).mockResolvedValue(null);
        const rate = await CurrencyService.getRate('USD', 'CAD');
        expect(rate).toBe(1.38);
        expect(queries.run).toHaveBeenCalled();
    });

    it('uses cached rate if it is fresh', async () => {
        const mockRate = { rate: 1.5, updated_at: new Date().toISOString() };
        (queries.get as any).mockResolvedValue(mockRate);
        const rate = await CurrencyService.getRate('USD', 'CAD');
        expect(rate).toBe(1.5);
        expect(queries.run).not.toHaveBeenCalled();
    });

    it('converts amounts correctly', async () => {
        (queries.get as any).mockResolvedValue({ rate: 1.4, updated_at: new Date().toISOString() });
        const converted = await CurrencyService.convert(100, 'USD', 'CAD');
        expect(converted).toBe(140);
    });
});
