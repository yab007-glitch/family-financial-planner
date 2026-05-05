import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './server';

describe('Server Integration', () => {
    it('responds to health check', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('healthy');
    });
    it('returns 404 for unknown API routes', async () => {
        const res = await request(app).get('/api/unknown');
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });
    it('serves the SPA for non-API routes', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.text).toContain('<!DOCTYPE html>');
    });
});
