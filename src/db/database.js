const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Vercel uses /tmp for writable storage; local dev uses project root
const isVercel = !!process.env.VERCEL;
const dbDir = isVercel ? os.tmpdir() : path.join(__dirname, '../../');
const dbPath = process.env.DB_PATH || path.join(dbDir, 'planner.db');
const db = new sqlite3.Database(dbPath);

// Enable WAL mode for better performance
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

// Run migrations if schema file exists
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema, (err) => {
    if (err) console.error('Migration error:', err);
  });
}

module.exports = db;