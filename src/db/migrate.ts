import fs from 'fs';
import path from 'path';
import db from './database';

const schemaPath = path.join(__dirname, 'schema.sql');

export function runMigrations(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(schemaPath)) {
            console.warn('⚠️ schema.sql not found');
            return resolve();
        }
        const schema = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schema, (err) => {
            if (err) {
                console.error('❌ Migration error:', err);
                reject(err);
            } else {
                console.log('✅ Database schema applied');
                resolve();
            }
        });
    });
}

if (require.main === module) {
    runMigrations()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
