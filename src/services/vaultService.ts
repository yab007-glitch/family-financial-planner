import crypto from 'crypto';
import fs from 'fs';
import { CONFIG } from '../config';

export class VaultService {
    private static readonly ALGORITHM = 'aes-256-cbc';
    private static readonly SECRET = CONFIG.JWT_SECRET.substring(0, 32); 

    /**
     * Encrypt a file and save it to disk.
     */
    public static async encryptAndSave(buffer: Buffer, originalName: string): Promise<{ filePath: string, key: string }> {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.ALGORITHM, Buffer.from(this.SECRET), iv);
        
        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
        const storagePath = `uploads/${crypto.randomUUID()}`;
        
        if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
        
        // We store the IV with the file or in the DB. Here we'll prefix it.
        fs.writeFileSync(storagePath, Buffer.concat([iv, encrypted]));
        
        return {
            filePath: storagePath,
            key: iv.toString('hex') // In a more complex app, this would be a separate per-file key
        };
    }

    /**
     * Read and decrypt a file.
     */
    public static async decrypt(filePath: string): Promise<Buffer> {
        const fileData = fs.readFileSync(filePath);
        const iv = fileData.subarray(0, 16);
        const encrypted = fileData.subarray(16);
        
        const decipher = crypto.createDecipheriv(this.ALGORITHM, Buffer.from(this.SECRET), iv);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }
}
