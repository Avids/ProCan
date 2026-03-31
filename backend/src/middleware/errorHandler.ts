import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('[Error]:', err.message);

  // Mask database connection errors specifically
  let message = err.message || 'Internal Server Error';
  if (message.includes('Can\'t reach database server') || message.includes('Prisma')) {
    message = 'The database is currently unreachable. Please contact an administrator or try again later.';
  }

  res.status(err.status || 500).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
