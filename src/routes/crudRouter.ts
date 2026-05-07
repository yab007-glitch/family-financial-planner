import { Router, Request, Response } from 'express';
import { z } from 'zod';
import queries from '../db/queries';
import { validateFamilySlug } from '../middleware/familySlug';
import { sendSuccess, sendError } from '../utils/response';

// #1: Strict allowlist for tables and columns — used at router construction time
const ALLOWED_TABLES = new Set([
    'members', 'accounts', 'debts', 'insurance', 'goals',
    'budget_entries', 'action_items', 'milestones', 'recurring_items',
]);

const ALLOWED_COLUMNS: Record<string, ReadonlySet<string>> = {
    members: new Set(['name', 'role', 'age', 'notes']),
    accounts: new Set(['type', 'institution', 'balance', 'contribution_room', 'target_allocation', 'notes']),
    debts: new Set(['type', 'balance', 'interest_rate', 'monthly_payment', 'original_amount', 'start_date', 'notes']),
    insurance: new Set(['type', 'provider', 'coverage', 'premium', 'status', 'renewal_date', 'notes']),
    goals: new Set(['timeframe', 'priority', 'description', 'target_amount', 'current_amount', 'monthly_contribution', 'deadline', 'status', 'project_return', 'notes']),
    budget_entries: new Set(['month_year', 'category', 'subcategory', 'amount', 'type', 'notes']),
    action_items: new Set(['phase', 'description', 'status', 'due_date', 'completed_at', 'notes']),
    milestones: new Set(['name', 'target_date', 'status', 'celebration_plan']),
    recurring_items: new Set(['name', 'category', 'subcategory', 'amount', 'type', 'frequency', 'start_date', 'end_date', 'active']),
};

// #15: Max string length for free-text fields like notes
const MAX_STRING_LENGTH = 10000;

function sanitizeValue(val: unknown): unknown {
    if (typeof val === 'string' && val.length > MAX_STRING_LENGTH) {
        return val.slice(0, MAX_STRING_LENGTH);
    }
    return val;
}

// #1: Build Zod schema with proper string length constraints
function buildZodSchema(columns: ReadonlySet<string>, requiredColumns: Set<string>) {
    const shape: Record<string, any> = {};
    for (const col of columns) {
        if (requiredColumns.has(col)) {
            shape[col] = z.union([z.string().max(MAX_STRING_LENGTH), z.number()]);
        } else {
            shape[col] = z.union([z.string().max(MAX_STRING_LENGTH), z.number()]).optional().nullable();
        }
    }
    return z.object(shape);
}

async function logAudit(familyId: number | undefined, userId: number | undefined, action: string, entityType: string, entityId: number, oldValue: unknown, newValue: unknown, req?: Request) {
    if (!userId || !familyId) return;
    try {
        await queries.run(
            `INSERT INTO audit_logs (family_id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                familyId,
                userId,
                action,
                entityType,
                entityId,
                oldValue ? JSON.stringify(oldValue) : null,
                newValue ? JSON.stringify(newValue) : null,
                req?.ip || 'unknown',
                req?.headers?.['user-agent']?.toString().slice(0, 500) || 'unknown',
            ]
        );
    } catch {
        // Audit logging should not break user-facing operations
    }
}

interface CrudRouterOptions {
    table: string;
    columns: string[];
    requiredColumns?: string[];
    orderBy?: string;
    allowedFilters?: string[];
    schema?: z.ZodObject<any>;
}

export function createCrudRouter(options: CrudRouterOptions) {
    const router = Router({ mergeParams: true });
    const { table, columns, requiredColumns = [], orderBy, allowedFilters = [] } = options;

    // #1: Validate table and columns at startup using Sets
    if (!ALLOWED_TABLES.has(table)) {
        throw new Error(`Table "${table}" is not whitelisted for CRUD operations`);
    }

    const tableColumns = ALLOWED_COLUMNS[table];
    if (!tableColumns) {
        throw new Error(`No column whitelist defined for table "${table}"`);
    }

    for (const col of columns) {
        if (!tableColumns.has(col)) {
            throw new Error(`Column "${col}" is not whitelisted for table "${table}"`);
        }
    }

    const requiredSet = new Set(requiredColumns);
    for (const col of requiredColumns) {
        if (!columns.includes(col)) {
            throw new Error(`Required column "${col}" must be in the columns list`);
        }
    }

    const bodySchema = options.schema || buildZodSchema(new Set(columns), requiredSet);

    // #1: Validate allowedFilters against column allowlist
    const filterSet = new Set(allowedFilters);
    for (const filter of allowedFilters) {
        if (!tableColumns.has(filter)) {
            throw new Error(`Filter "${filter}" is not a valid column for table "${table}"`);
        }
    }

    router.use(validateFamilySlug);

    router.get('/', async (req: Request, res: Response) => {
        try {
            const paginationSchema = z.object({
                page: z.string().optional().default('1'),
                limit: z.string().optional().default('50'),
            });
            const { page: pageStr, limit: limitStr } = paginationSchema.parse(req.query);
            const page = Math.max(1, parseInt(pageStr, 10));
            const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10)));
            const offset = (page - 1) * limit;

            // #1: Use parameterized column name quoting for safety
            const safeColumns = columns.map(c => `\`${c}\``).join(', ');

            // #1: Count query — no dynamic column names needed
            let countSql = 'SELECT COUNT(*) as total FROM `' + table + '` WHERE family_id = ?';
            const countParams: unknown[] = [req.familyId];
            const countRow = await queries.get<{ total: number }>(countSql, countParams);
            const total = countRow?.total ?? 0;

            // Build SELECT query with allowlisted filters only
            let sql = `SELECT ${safeColumns ? '* ' : '*'} FROM \`${table}\` WHERE family_id = ?`;
            const params: unknown[] = [req.familyId];

            // #1: Filters are validated against allowlist at startup
            for (const key of Object.keys(req.query)) {
                if (filterSet.has(key as string)) {
                    sql += ` AND \`${key}\` = ?`;
                    params.push(req.query[key]);
                }
            }

            if (orderBy) sql += ` ORDER BY \`${orderBy}\``;
            sql += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const rows = await queries.all(sql, params);
            sendSuccess(res, rows, { page, limit, total });
        } catch (err) {
            if (err instanceof z.ZodError) {
                return sendError(res, 'Invalid pagination parameters', 400);
            }
            console.error('CRUD GET error:', err);
            sendError(res, 'An error occurred while fetching data', 500);
        }
    });

    router.post('/', async (req: Request, res: Response) => {
        try {
            const data = req.body;

            // #15: Sanitize values before validation
            for (const key of Object.keys(data)) {
                data[key] = sanitizeValue(data[key]);
            }

            const validation = bodySchema.safeParse(data);

            if (!validation.success) {
                const message = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
                return sendError(res, `Validation error: ${message}`, 400);
            }

            for (const col of requiredColumns) {
                if (data[col] === undefined || data[col] === null || data[col] === '') {
                    return sendError(res, `${col} is required`, 400);
                }
            }

            const insertCols = ['family_id', ...columns];
            const placeholders = insertCols.map(() => '?').join(',');
            const values = [req.familyId, ...columns.map((c) => data[c] ?? null)];

            // #1: Safe — table and columns validated at construction time
            const result = await queries.run(`INSERT INTO \`${table}\` (\`${insertCols.join('`,`')}\`) VALUES (${placeholders})`, values);
            await logAudit(req.familyId, req.userId, 'CREATE', table, result.lastID, null, data, req);

            sendSuccess(res, { id: result.lastID, ...data });
        } catch (err) {
            console.error('CRUD POST error:', err);
            sendError(res, 'An error occurred while creating the record', 500);
        }
    });

    router.put('/:id', async (req: Request, res: Response) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id) || id <= 0) {
                return sendError(res, 'Invalid id parameter', 400);
            }

            const data = req.body;

            // #15: Sanitize values
            for (const key of Object.keys(data)) {
                data[key] = sanitizeValue(data[key]);
            }

            const validation = (bodySchema as z.ZodObject<any>).partial().safeParse(data);

            if (!validation.success) {
                const message = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
                return sendError(res, `Validation error: ${message}`, 400);
            }

            const existing = await queries.get(`SELECT * FROM \`${table}\` WHERE id = ? AND family_id = ?`, [id, req.familyId]);
            if (!existing) {
                return sendError(res, 'Record not found', 404);
            }

            const activeColumns = columns.filter(c => data[c] !== undefined);
            if (activeColumns.length === 0) {
                return sendError(res, 'No fields to update', 400);
            }

            // #1: Safe — columns are allowlisted at construction time
            const setClause = activeColumns.map((c) => `\`${c}\` = ?`).join(', ');
            const values = [...activeColumns.map((c) => data[c] ?? null), id, req.familyId];

            const result = await queries.run(`UPDATE \`${table}\` SET ${setClause} WHERE id = ? AND family_id = ?`, values);
            if (result.changes === 0) {
                return sendError(res, 'Record not found', 404);
            }

            await logAudit(req.familyId, req.userId, 'UPDATE', table, id, existing, data, req);
            sendSuccess(res, { updated: true });
        } catch (err) {
            console.error('CRUD PUT error:', err);
            sendError(res, 'An error occurred while updating the record', 500);
        }
    });

    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id) || id <= 0) {
                return sendError(res, 'Invalid id parameter', 400);
            }

            const existing = await queries.get(`SELECT * FROM \`${table}\` WHERE id = ? AND family_id = ?`, [id, req.familyId]);
            if (!existing) {
                return sendError(res, 'Record not found', 404);
            }

            const result = await queries.run(`DELETE FROM \`${table}\` WHERE id = ? AND family_id = ?`, [
                id,
                req.familyId,
            ]);

            if (result.changes === 0) {
                return sendError(res, 'Record not found', 404);
            }

            await logAudit(req.familyId, req.userId, 'DELETE', table, id, existing, null, req);
            sendSuccess(res, { deleted: true });
        } catch (err) {
            console.error('CRUD DELETE error:', err);
            sendError(res, 'An error occurred while deleting the record', 500);
        }
    });

    return router;
}