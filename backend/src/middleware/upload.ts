import multer from 'multer';
import path from 'path';
import fs from 'fs';

// We use memory storage to buffer the file before pushing it to S3, for both dev and Vercel.
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
