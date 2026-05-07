// #12: Switch from sqlite3 (callback-based, single conn) to better-sqlite3 (sync, better perf)
import BetterSqlite3 from 'better-sqlite3';
import { CONFIG } from '../config';

const db = new BetterSqlite3(CONFIG.DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

console.log(`📁 SQLite connected: ${CONFIG.DB_PATH}`);

export function healthCheck(): boolean {
    try {
        db.prepare('SELECT 1').get();
        return true;
    } catch {
        return false;
    }
}

export function closeDb(): void {
    db.close();
}

export default db;