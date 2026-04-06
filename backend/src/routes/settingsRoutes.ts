import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { upload } from '../middleware/upload';
import { uploadToS3, deleteFromS3 } from '../utils/s3';

const router = Router();
const prisma = new PrismaClient();

// ── NEW: logo upload ────────────────────────────────────────────────────────
router.post('/logo', upload.single('logo'), async (req: any, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No logo provided' });
  try {
    const settings = await prisma.companySettings.findUnique({ where: { id: 'singleton' } });
    if (settings?.logoUrl) {
      // Extract s3 key from URL path or store as metadata if we had it.
      // For now, let's just upload the new one.
    }
    const { url } = await uploadToS3(req.file);
    const updated = await prisma.companySettings.upsert({
      where: { id: 'singleton' },
      update: { logoUrl: url, updatedAt: new Date() },
      create: { id: 'singleton', logoUrl: url, name: 'My Company', updatedAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// ── GET company settings (auto-create singleton if missing) ─────────────────
router.get('/company', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.companySettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton', name: 'My Company', updatedAt: new Date() },
    });
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch company settings' });
  }
});

// ── PUT update company settings ─────────────────────────────────────────────
router.put('/company', async (req: Request, res: Response) => {
  const { name, address, city, province, postalCode, phone, email, website, logoUrl } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name is required' });
  try {
    const settings = await prisma.companySettings.upsert({
      where: { id: 'singleton' },
      update: { name, address, city, province, postalCode, phone, email, website, logoUrl, updatedAt: new Date() },
      create: { id: 'singleton', name, address, city, province, postalCode, phone, email, website, logoUrl, updatedAt: new Date() },
    });
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save company settings' });
  }
});

export default router;
