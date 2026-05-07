import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number = 400,
        public isOperational: boolean = true
    ) {
        super(message);
        Object.setPrototypeOf(this, AppError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}

export function errorHandler(
    err: Error | AppError,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
        });
        return;
    }

    // #13: Never leak internal error details to the client
    console.error('💥 Unexpected error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
}