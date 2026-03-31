import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log full error details server-side (visible in Vercel Function logs)
  console.error('[ProCan Error]:', err);

  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    code: err.code || null,
    // Expose stack temporarily so we can diagnose Vercel crashes
    detail: err.stack || null,
  });
};
