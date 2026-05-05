import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server';
import queries from '../db/queries';

let cookies: Record<string, string> = {};
let csrfToken = '';

function extractCookies(res: any) {
    const result: Record<string, string> = {};
    const setCookie = res.headers['set-cookie'];
    if (Array.isArray(setCookie)) {
        for (const c of setCookie) {
            const [nameValue] = c.split(';');
            const [name, value] = nameValue.split('=');
            result[name.trim()] = decodeURIComponent(value.trim());
        }
    }
    return result;
}

function cookieHeader(cookies: Record<string, string>) {
    return Object.entries(cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
}

describe('Families CRUD Integration', () => {
    async function authReq(method: 'get' | 'post' | 'put' | 'delete', path: string, body?: object) {
        const builder = (request(app) as any)[method](path);
        builder.set('Cookie', cookieHeader(cookies));
        if (method !== 'get') builder.set('X-CSRF-Token', csrfToken);
        if (body) builder.send(body);
        return builder;
    }

    beforeAll(async () => {
        await queries.run("DELETE FROM users WHERE email = 'family-test@example.com'");
        await queries.run("DELETE FROM families WHERE slug = 'test-family'");
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'family-test@example.com', password: 'Password123!', name: 'Test User' });
        expect(res.status).toBe(200);
        cookies = extractCookies(res);
        csrfToken = res.body.data.csrfToken;
    });

    afterAll(async () => {
        await queries.run("DELETE FROM users WHERE email = 'family-test@example.com'");
        await queries.run("DELETE FROM families WHERE slug = 'test-family'");
    });

    it('creates a family', async () => {
        const res = await authReq('post', '/api/families', { name: 'Test Family', slug: 'test-family', location: 'Montreal, QC' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.slug).toBe('test-family');
    });

    it('lists families', async () => {
        const res = await authReq('get', '/api/families');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('gets a family by slug', async () => {
        const res = await authReq('get', '/api/families/test-family');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe('Test Family');
        expect(res.body.data.members).toBeDefined();
    });

    it('updates a family', async () => {
        const res = await authReq('put', '/api/families/test-family', { location: 'Toronto, ON' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 404 for non-existent family', async () => {
        const res = await authReq('get', '/api/families/nonexistent');
        expect(res.status).toBe(404);
    });
});
