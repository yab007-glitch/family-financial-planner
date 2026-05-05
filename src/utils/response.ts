import { Response } from 'express';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    meta?: any;
}

export function sendSuccess<T>(res: Response, data: T, meta?: any): void {
    res.json({ success: true, data, meta });
}

export function sendError(res: Response, message: string, statusCode: number = 400): void {
    res.status(statusCode).json({ success: false, error: message });
}

// Keeping legacy exports for compatibility during refactor
export const success = (data: any, meta?: any) => ({ success: true, data, meta });
export const error = (message: string) => ({ success: false, error: message });
