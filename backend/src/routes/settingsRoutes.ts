import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { upload } from '../middleware/upload';
import { uploadToS3, deleteFromS3, getPresignedUrl } from '../utils/s3';

const router = Router();
const prisma = new PrismaClient();

// ── GET logo proxy (for PDF generation - bypasses CORS) ─────────────────────
router.get('/logo/proxy', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.companySettings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.logoUrl) return res.status(404).json({ error: 'No logo set' });

    let finalUrl = settings.logoUrl;
    if (finalUrl.includes('.amazonaws.com/')) {
      const key = finalUrl.split('.amazonaws.com/')[1].split('?')[0];
      if (key) finalUrl = await getPresignedUrl(key);
    }

    const response = await fetch(finalUrl);
    if (!response.ok) throw new Error(`Failed to fetch logo: ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    const base64 = Buffer.from(buffer).toString('base64');
    res.json({ base64: `data:${contentType};base64,${base64}` });
  } catch (err: any) {
    console.error('Logo proxy error:', err);
    res.status(500).json({ error: 'Failed to proxy logo' });
  }
});

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
    
    if (updated.logoUrl) {
      const bucket = process.env.AWS_S3_BUCKET;
      if (bucket && updated.logoUrl.includes(bucket)) {
        const key = updated.logoUrl.split('.amazonaws.com/')[1];
        if (key) {
          try {
            updated.logoUrl = await getPresignedUrl(key);
          } catch (e) { console.error('Failed to presign logo immediately', e); }
        }
      }
    }
    
    res.json(updated);
  } catch (err) {
    console.error('Logo upload error:', err);
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
    
    // Better: extract key if it's an S3 URL
    if (settings.logoUrl) {
      const bucket = process.env.AWS_S3_BUCKET;
      if (bucket && settings.logoUrl.includes(bucket)) {
        const key = settings.logoUrl.split('.amazonaws.com/')[1];
        if (key) {
          try {
            const presigned = await getPresignedUrl(key);
            settings.logoUrl = presigned;
          } catch (e) { console.error('Failed to presign logo', e); }
        }
      }
    }

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
  
  let dbLogoUrl = logoUrl;
  // If the frontend sends back a presigned URL, don't save the signatures to DB.
  // Extract back the raw base S3 URL
  if (dbLogoUrl && dbLogoUrl.includes('.amazonaws.com/')) {
    try {
        const urlObj = new URL(dbLogoUrl);
        dbLogoUrl = urlObj.origin + urlObj.pathname;
    } catch(e) {}
  }
  
  try {
    const settings = await prisma.companySettings.upsert({
      where: { id: 'singleton' },
      update: { name, address, city, province, postalCode, phone, email, website, logoUrl: dbLogoUrl, updatedAt: new Date() },
      create: { id: 'singleton', name, address, city, province, postalCode, phone, email, website, logoUrl: dbLogoUrl, updatedAt: new Date() },
    });
    
    // Return with presigned URL so page continues to display it correctly
    if (settings.logoUrl) {
      const bucket = process.env.AWS_S3_BUCKET;
      if (bucket && settings.logoUrl.includes(bucket)) {
        const key = settings.logoUrl.split('.amazonaws.com/')[1];
        if (key) {
          try { settings.logoUrl = await getPresignedUrl(key); } catch (e) {}
        }
      }
    }
    
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save company settings' });
  }
});

export default router;
