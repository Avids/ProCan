import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadToS3 } from '../utils/s3';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ message: 'Upload route is reachable' });
});

router.post('/', upload.single('file'), async (req: any, res) => {
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

  try {
    const s3Url = await uploadToS3(req.file);
    return res.json({ url: s3Url, filename: req.file.originalname });
  } catch (error: any) {
    console.error('S3 Upload Error:', error);
    return res.status(500).json({ message: 'Failed to upload to S3' });
  }
});

export default router;
