import { Router, Request, Response } from 'express';
import multer from 'multer';
import queries from '../db/queries';
import { validateFamilySlug } from '../middleware/familySlug';
import { sendSuccess, sendError } from '../utils/response';
import { VaultService } from '../services/vaultService';

const router = Router({ mergeParams: true });
router.use(validateFamilySlug);

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) return sendError(res, 'No file uploaded', 400);
        
        const f = req.familyId!;
        const { entity_type, entity_id } = req.body;

        // 1. Encrypt and save
        const { filePath, key } = await VaultService.encryptAndSave(req.file.buffer, req.file.originalname);

        // 2. Store metadata in DB
        const result = queries.run(
            'INSERT INTO attachments (family_id, entity_type, entity_id, name, file_path, content_type, file_size, encrypted_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [f, entity_type || 'will', entity_id || null, req.file.originalname, filePath, req.file.mimetype, req.file.size, key]
        );

        sendSuccess(res, { id: result.lastID, name: req.file.originalname });
    } catch (err) {
        console.error('Vault upload error:', err);
        sendError(res, 'Failed to secure document', 500);
    }
});

router.get('/:id/download', async (req: Request, res: Response) => {
    try {
        const doc = await queries.get<any>(
            'SELECT * FROM attachments WHERE id = ? AND family_id = ?',
            [req.params.id, req.familyId]
        );
        if (!doc) return sendError(res, 'Document not found', 404);

        const buffer = await VaultService.decrypt(doc.file_path);
        
        res.setHeader('Content-Type', doc.content_type);
        res.setHeader('Content-Disposition', `attachment; filename="${doc.name}"`);
        res.send(buffer);
    } catch (err) {
        console.error('Vault download error:', err);
        sendError(res, 'Failed to retrieve document', 500);
    }
});

router.get('/', async (req: Request, res: Response) => {
    try {
        const docs = await queries.all(
            'SELECT id, name, entity_type, created_at, file_size FROM attachments WHERE family_id = ? ORDER BY created_at DESC',
            [req.familyId]
        );
        sendSuccess(res, docs);
    } catch (err) {
        sendError(res, 'Failed to fetch vault', 500);
    }
});

export default router;
