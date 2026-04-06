import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

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
  const { name, address, city, province, postalCode, phone, email, website } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name is required' });
  try {
    const settings = await prisma.companySettings.upsert({
      where: { id: 'singleton' },
      update: { name, address, city, province, postalCode, phone, email, website, updatedAt: new Date() },
      create: { id: 'singleton', name, address, city, province, postalCode, phone, email, website, updatedAt: new Date() },
    });
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save company settings' });
  }
});

export default router;
