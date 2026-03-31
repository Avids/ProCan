import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log full error details server-side (visible in Vercel Function logs)
  console.error('[ProCan Error]:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle Prisma connection errors specifically (common in serverless)
  if (err.code === 'P1001') {
    return res.status(503).json({ message: 'Database unreachable. Check DATABASE_URL and network access.', code: err.code });
  }
  if (err.code === 'P1002') {
    return res.status(503).json({ message: 'Database connection timed out.', code: err.code });
  }
  if (err.code === 'P1003') {
    return res.status(503).json({ message: 'Database not found. Check DATABASE_URL.', code: err.code });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    code: err.code || null,
    detail: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });
};
