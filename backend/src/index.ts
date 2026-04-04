import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './utils/db';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());


// API Routes
app.use('/api/v1', routes);

// Generic Health Check
app.get('/api/v1/health', async (req: Request, res: Response) => {
  const dbUrl = process.env.DATABASE_URL;
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'OK',
      database: 'connected',
      env: {
        DATABASE_URL: dbUrl ? `${dbUrl.split('@')[1] || '(set)'}` : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
      }
    });
  } catch (error: any) {
    console.error('[Health Check] DB Error:', error);
    res.status(500).json({
      status: 'ERROR',
      database: 'disconnected',
      error: error.message,
      errorCode: error.code,
      env: {
        DATABASE_URL: dbUrl ? '(set but connection failed)' : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
      }
    });
  }
});

// Centralized Error Handling
app.use(errorHandler);

// Only listen when running locally
if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

// Export app for Vercel Serverless Functions
export default app;

