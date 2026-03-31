import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ message: 'Upload route is reachable' });
});

router.post('/', upload.single('file'), (req: any, res) => {
  console.log('Upload Request Received:', {
    user: req.user?.email,
    file: req.file ? {
      originalname: req.file.originalname,
      size: req.file.size,
      hasBuffer: !!req.file.buffer,
      hasPath: !!req.file.path,
    } : 'NO FILE'
  });

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  // On Vercel: memory storage → convert to base64 data URL
  if (req.file.buffer) {
    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'application/octet-stream';
    const dataUrl = `data:${mimeType};base64,${base64}`;
    return res.json({ url: dataUrl, filename: req.file.originalname });
  }

  // Locally: disk storage → return static file path
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.originalname });
});

export default router;
