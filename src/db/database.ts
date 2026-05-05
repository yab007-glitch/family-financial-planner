import sqlite3 from 'sqlite3';
import { CONFIG } from '../config';

const db = new sqlite3.Database(CONFIG.DB_PATH, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
        process.exit(1);
    } else {
        console.log(`📁 SQLite connected: ${CONFIG.DB_PATH}`);
    }
});

db.run('PRAGMA journal_mode = WAL', (err) => {
    if (err) console.error('WAL mode error:', err.message);
    else console.log('✅ WAL mode enabled');
});

db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA busy_timeout = 5000');
db.run('PRAGMA synchronous = NORMAL');

export function healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
        db.get('SELECT 1', (err) => {
            resolve(!err);
        });
    });
}

export function closeDb(): Promise<void> {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

export default db;
