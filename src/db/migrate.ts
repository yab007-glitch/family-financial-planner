import fs from 'fs';
import path from 'path';
import db from './database';

const schemaPath = path.join(__dirname, 'schema.sql');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// #26: Track applied migrations with version table
function ensureMigrationTable(): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

function getAppliedMigrations(): Set<string> {
    ensureMigrationTable();
    const rows = db.prepare('SELECT name FROM _migrations ORDER BY id').all() as { name: string }[];
    return new Set(rows.map(r => r.name));
}

function recordMigration(name: string): void {
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
}

export function runMigrations(): void {
    // 1. Apply base schema (idempotent via IF NOT EXISTS)
    if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schema);
        console.log('✅ Database base schema applied');
    } else {
        console.warn('⚠️ schema.sql not found');
    }

    // 2. Run incremental migrations from /migrations directory
    if (fs.existsSync(MIGRATIONS_DIR)) {
        const applied = getAppliedMigrations();
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        for (const file of files) {
            if (!applied.has(file)) {
                const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
                try {
                    db.exec(sql);
                    recordMigration(file);
                    console.log(`✅ Migration applied: ${file}`);
                } catch (err) {
                    console.error(`❌ Migration failed: ${file}`, err);
                    throw err;
                }
            }
        }
    }

    // 3. Record base schema as migration if not yet tracked
    ensureMigrationTable();
    const applied = getAppliedMigrations();
    if (!applied.has('000_base_schema.sql')) {
        recordMigration('000_base_schema.sql');
    }
}

if (require.main === module) {
    try {
        runMigrations();
        process.exit(0);
    } catch {
        process.exit(1);
    }
}