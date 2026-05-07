import db from './database';

// #12: Synchronous query wrappers using better-sqlite3
export const queries = {
    get<T>(sql: string, params: any[] = []): T | undefined {
        return db.prepare(sql).get(params) as T | undefined;
    },

    all<T>(sql: string, params: any[] = []): T[] {
        return db.prepare(sql).all(params) as T[];
    },

    run(sql: string, params: any[] = []): { lastID: number; changes: number } {
        const result = db.prepare(sql).run(params);
        return { lastID: Number(result.lastInsertRowid), changes: result.changes };
    },

    // Transaction helper - wraps multiple operations in a single transaction
    transaction<T>(fn: () => T): T {
        return db.transaction(fn)();
    },
};

export default queries;