import { Router, Request, Response } from 'express';
import { z } from 'zod';
import queries from '../db/queries';
import { validateFamilySlug } from '../middleware/familySlug';
import { sendSuccess, sendError } from '../utils/response';

const ALLOWED_TABLES = [
    'members', 'accounts', 'debts', 'insurance', 'goals',
    'budget_entries', 'action_items', 'milestones', 'recurring_items',
];

const ALLOWED_COLUMNS: Record<string, string[]> = {
    members: ['name', 'role', 'age', 'notes'],
    accounts: ['type', 'institution', 'balance', 'contribution_room', 'target_allocation', 'notes'],
    debts: ['type', 'balance', 'interest_rate', 'monthly_payment', 'original_amount', 'start_date', 'notes'],
    insurance: ['type', 'provider', 'coverage', 'premium', 'status', 'renewal_date', 'notes'],
    goals: ['timeframe', 'priority', 'description', 'target_amount', 'current_amount', 'monthly_contribution', 'deadline', 'status', 'project_return', 'notes'],
    budget_entries: ['month_year', 'category', 'subcategory', 'amount', 'type', 'notes'],
    action_items: ['phase', 'description', 'status', 'due_date', 'completed_at', 'notes'],
    milestones: ['name', 'target_date', 'status', 'celebration_plan'],
    recurring_items: ['name', 'category', 'subcategory', 'amount', 'type', 'frequency', 'start_date', 'end_date', 'active'],
};

function buildZodSchema(columns: string[], requiredColumns: string[]) {
    const shape: any = {};
    for (const col of columns) {
        if (requiredColumns.includes(col)) {
            shape[col] = z.union([z.string(), z.number()]);
        } else {
            shape[col] = z.union([z.string(), z.number()]).optional().nullable();
        }
    }
    return z.object(shape);
}

async function logAudit(familyId?: number, userId?: number, action?: string, entityType?: string, entityId?: number, oldValue?: any, newValue?: any) {
    if (!userId || !familyId) return;
    try {
        await queries.run(
            `INSERT INTO audit_logs (family_id, user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                familyId,
                userId,
                action,
                entityType,
                entityId,
                oldValue ? JSON.stringify(oldValue) : null,
                newValue ? JSON.stringify(newValue) : null,
            ]
        );
    } catch {
        // Audit logging should not break user-facing operations
    }
}

const paginationSchema = z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('50'),
});

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

    if (!ALLOWED_TABLES.includes(table)) {
        throw new Error(`Table "${table}" is not whitelisted for CRUD operations`);
    }

    const tableColumns = ALLOWED_COLUMNS[table];
    if (!tableColumns) {
        throw new Error(`No column whitelist defined for table "${table}"`);
    }

    for (const col of columns) {
        if (!tableColumns.includes(col)) {
            throw new Error(`Column "${col}" is not whitelisted for table "${table}"`);
        }
    }

    for (const col of requiredColumns) {
        if (!columns.includes(col)) {
            throw new Error(`Required column "${col}" must be in the columns list`);
        }
    }

    const bodySchema = options.schema || buildZodSchema(columns, requiredColumns);

    router.use(validateFamilySlug);

    router.get('/', async (req: Request, res: Response) => {
        try {
            const { page: pageStr, limit: limitStr } = paginationSchema.parse(req.query);
            const page = Math.max(1, parseInt(pageStr, 10));
            const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10)));
            const offset = (page - 1) * limit;

            let sql = `SELECT * FROM ${table} WHERE family_id = ?`;
            const params: any[] = [req.familyId];

            for (const key of Object.keys(req.query)) {
                if (allowedFilters.includes(key)) {
                    sql += ` AND ${key} = ?`;
                    params.push(req.query[key]);
                }
            }

            const countSql = `SELECT COUNT(*) as total FROM ${table} WHERE family_id = ?`;
            const countRow = await queries.get<{ total: number }>(countSql, [req.familyId]);
            const total = countRow?.total ?? 0;

            if (orderBy) sql += ` ORDER BY ${orderBy}`;
            sql += ` LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const rows = await queries.all(sql, params);
            sendSuccess(res, rows, { page, limit, total });
        } catch (err) {
            if (err instanceof z.ZodError) {
                return sendError(res, 'Invalid pagination parameters', 400);
            }
            sendError(res, 'An error occurred while fetching data', 500);
        }
    });

    router.post('/', async (req: Request, res: Response) => {
        try {
            const data = req.body;
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

            const result = await queries.run(`INSERT INTO ${table} (${insertCols.join(',')}) VALUES (${placeholders})`, values);
            await logAudit(req.familyId, req.userId, 'CREATE', table, result.lastID, null, data);

            sendSuccess(res, { id: result.lastID, ...req.body });
        } catch (err) {
            sendError(res, 'An error occurred while creating the record', 500);
        }
    });

    router.put('/:id', async (req: Request, res: Response) => {
        try {
            const data = req.body;
            const validation = (bodySchema as z.ZodObject<any>).partial().safeParse(data);

            if (!validation.success) {
                const message = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
                return sendError(res, `Validation error: ${message}`, 400);
            }

            const existing = await queries.get(`SELECT * FROM ${table} WHERE id = ? AND family_id = ?`, [req.params.id, req.familyId]);
            if (!existing) {
                return sendError(res, 'Record not found', 404);
            }

            const activeColumns = columns.filter(c => data[c] !== undefined);
            if (activeColumns.length === 0) {
                return sendError(res, 'No fields to update', 400);
            }

            const setClause = activeColumns.map((c) => `${c} = ?`).join(', ');
            const values = [...activeColumns.map((c) => data[c] ?? null), req.params.id, req.familyId];

            const result = await queries.run(`UPDATE ${table} SET ${setClause} WHERE id = ? AND family_id = ?`, values);
            if (result.changes === 0) {
                return sendError(res, 'Record not found', 404);
            }

            await logAudit(req.familyId, req.userId, 'UPDATE', table, parseInt(req.params.id, 10), existing, data);
            sendSuccess(res, { updated: true });
        } catch (err) {
            sendError(res, 'An error occurred while updating the record', 500);
        }
    });

    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            const existing = await queries.get(`SELECT * FROM ${table} WHERE id = ? AND family_id = ?`, [req.params.id, req.familyId]);
            if (!existing) {
                return sendError(res, 'Record not found', 404);
            }

            const result = await queries.run(`DELETE FROM ${table} WHERE id = ? AND family_id = ?`, [
                req.params.id,
                req.familyId,
            ]);

            if (result.changes === 0) {
                return sendError(res, 'Record not found', 404);
            }

            await logAudit(req.familyId, req.userId, 'DELETE', table, parseInt(req.params.id, 10), existing, null);
            sendSuccess(res, { deleted: true });
        } catch (err) {
            sendError(res, 'An error occurred while deleting the record', 500);
        }
    });

    return router;
}
