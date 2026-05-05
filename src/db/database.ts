import sqlite3 from 'sqlite3';
import { CONFIG } from '../config';

const db = new sqlite3.Database(CONFIG.DB_PATH, (err) => {
    if (err)
        console.error('Database connection error:', err);
    else
        console.log(`📁 SQLite connected: ${CONFIG.DB_PATH}`);
});

db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA busy_timeout = 5000');

export default db;
