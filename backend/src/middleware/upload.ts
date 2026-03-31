import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Vercel's filesystem is read-only except for /tmp.
// On Vercel, we use memory storage and return the file as a base64 URL.
// Locally (Docker/dev), we use disk storage in the /uploads directory.
const isVercel = !!process.env.VERCEL;

let storage: multer.StorageEngine;

if (isVercel) {
  // Memory storage for serverless — no filesystem writes
  storage = multer.memoryStorage();
} else {
  const uploadDir = path.join(process.cwd(), 'uploads');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (e) {
    console.warn('[Upload] Could not create uploads directory:', e);
  }

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });
}

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
