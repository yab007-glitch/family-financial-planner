import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server';
import queries from '../db/queries';

describe('Auth Integration', () => {
    beforeAll(async () => {
        await queries.run("DELETE FROM users WHERE email = 'test@example.com'");
    });
    afterAll(async () => {
        await queries.run("DELETE FROM users WHERE email = 'test@example.com'");
    });
    it('registers a new user', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'test@example.com', password: 'Password123!', name: 'Test User' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe('test@example.com');
        expect(res.headers['set-cookie']).toBeDefined();
        expect(res.body.data.csrfToken).toBeDefined();
    });
    it('prevents duplicate registration', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'test@example.com', password: 'Password123!', name: 'Test User' });
        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
    });
    it('logs in with valid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'Password123!' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.headers['set-cookie']).toBeDefined();
        expect(res.body.data.csrfToken).toBeDefined();
    });
    it('rejects invalid login', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'wrongpassword' });
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });
});
