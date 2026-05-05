import db from './database';

export const queries = {
    get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row as T);
            });
        });
    },
    all<T>(sql: string, params: any[] = []): Promise<T[]> {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows as T[]);
            });
        });
    },
    run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err)
                    reject(err);
                else
                    resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    },
};

export default queries;
