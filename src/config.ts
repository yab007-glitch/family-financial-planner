import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

function required(key: string): string {
    const value = process.env[key];
    if (!value)
        throw new Error(`Missing required environment variable: ${key}`);
    return value;
}

const isDev = (process.env.NODE_ENV || 'development') === 'development';

export const CONFIG = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '4000', 10),
    DB_PATH: process.env.DB_PATH || path.join(__dirname, '../planner.db'),
    JWT_SECRET: required('JWT_SECRET'),
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    CORS_ORIGIN: process.env.CORS_ORIGIN || (isDev ? 'http://localhost:4000' : false),
    COOKIE_SECURE: process.env.COOKIE_SECURE === 'true' || !isDev,
    COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || 'lax',
};
