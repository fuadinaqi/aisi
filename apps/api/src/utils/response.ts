import { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  pagination?: { page: number; limit: number; total: number; totalPages: number },
) {
  res.status(statusCode).json({
    success: true,
    data,
    message,
    ...(pagination && { pagination }),
  });
}

export function sendError(res: Response, message: string, statusCode = 400) {
  res.status(statusCode).json({ success: false, message });
}
