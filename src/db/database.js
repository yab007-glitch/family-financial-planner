const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../planner.db');
const db = new sqlite3.Database(dbPath);

// Enable WAL mode for better performance
db.run('PRAGMA journal_mode = WAL');

// Run migrations if schema file exists
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema, (err) => {
    if (err) console.error('Migration error:', err);
  });
}

module.exports = db;
