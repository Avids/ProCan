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
      filename: req.file.filename,
      size: req.file.size
    } : 'NO FILE'
  });

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  // Construct a public URL
  // In a real app, this might be a static URL or S3 URL
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.originalname });
});

export default router;
