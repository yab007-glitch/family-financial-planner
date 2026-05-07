import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.join(__dirname, '../.env') });

function required(key: string): string {
    const value = process.env[key];
    if (!value)
        throw new Error(`Missing required environment variable: ${key}`);
    return value;
}

const isDev = (process.env.NODE_ENV || 'development') === 'development';

// #2: Validate JWT secret strength at startup
const JWT_SECRET = required('JWT_SECRET');
if (JWT_SECRET.length < 32) {
    throw new Error(
        `JWT_SECRET must be at least 32 characters long (got ${JWT_SECRET.length}). ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
}
// Reject known placeholder/default secrets
const WEAK_SECRETS = [
    'change-me-to-a-long-random-string-min-32-chars',
    'super-secret-family-key-2024',
    'secret',
    'changeme',
    'your-secret-key',
];
if (WEAK_SECRETS.includes(JWT_SECRET)) {
    throw new Error(
        'JWT_SECRET is set to a known default value. Replace it with a cryptographically random secret. ' +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
}

// #6: Validate CORS origin in production
const CORS_ORIGIN = process.env.CORS_ORIGIN || (isDev ? 'http://localhost:4000' : '');
if (!isDev && !process.env.CORS_ORIGIN) {
    throw new Error(
        'CORS_ORIGIN must be explicitly set in production. ' +
        'Set it to your frontend origin (e.g. https://your-app.railway.app)'
    );
}

export const CONFIG = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '4000', 10),
    DB_PATH: process.env.DB_PATH || path.join(__dirname, '../planner.db'),

    // Auth
    JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10), // #5: Auth-specific rate limit

    // CORS
    CORS_ORIGIN, // #6: always a valid string now
    COOKIE_SECURE: process.env.COOKIE_SECURE === 'true' || !isDev,
    COOKIE_SAME_SITE: (process.env.COOKIE_SAME_SITE || 'lax') as 'lax' | 'strict' | 'none',

    // Brute force protection (#9)
    AUTH_LOCKOUT_THRESHOLD: parseInt(process.env.AUTH_LOCKOUT_THRESHOLD || '5', 10),
    AUTH_LOCKOUT_DURATION_MS: parseInt(process.env.AUTH_LOCKOUT_DURATION_MS || '900000', 10), // 15 min
};

// Generate a random nonce for CSP on each server start
export function generateCspNonce(): string {
    return crypto.randomBytes(16).toString('base64');
}