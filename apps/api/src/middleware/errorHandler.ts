import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  if (env.NODE_ENV === 'development') {
    console.error(err);
  }

  return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
}
