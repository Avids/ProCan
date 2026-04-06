import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ── GET all stakeholders (with primary contact) ────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const stakeholders = await prisma.stakeholder.findMany({
      orderBy: { name: 'asc' },
      include: {
        contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        _count: {
          select: {
            projectsAsOwner: true,
            projectsAsGC: true,
            projectsAsArchitect: true,
            projectsAsEngineer: true,
          },
        },
      },
    });
    res.json(stakeholders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stakeholders' });
  }
});

// ── GET single stakeholder ─────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const s = await prisma.stakeholder.findUnique({
      where: { id: req.params.id },
      include: { contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } },
    });
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stakeholder' });
  }
});

// ── POST create stakeholder ────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  const { name, type, address, city, phone, email, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const s = await prisma.stakeholder.create({
      data: { name, type: type || 'OTHER', address, city, phone, email, notes },
      include: { contacts: true },
    });
    res.status(201).json(s);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create stakeholder' });
  }
});

// ── PATCH update stakeholder ───────────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
  const { name, type, address, city, phone, email, notes } = req.body;
  try {
    const s = await prisma.stakeholder.update({
      where: { id: req.params.id },
      data: { name, type, address, city, phone, email, notes },
      include: { contacts: true },
    });
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update stakeholder' });
  }
});

// ── DELETE stakeholder (cascades contacts) ─────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.stakeholder.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete stakeholder' });
  }
});

// ── POST add contact to stakeholder ───────────────────────────────────────
router.post('/:id/contacts', async (req: Request, res: Response) => {
  const { firstName, lastName, position, email, phone, isPrimary } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ error: 'First and last name required' });
  try {
    // If this contact is primary, clear existing primary
    if (isPrimary) {
      await prisma.stakeholderContact.updateMany({
        where: { stakeholderId: req.params.id },
        data: { isPrimary: false },
      });
    }
    const c = await prisma.stakeholderContact.create({
      data: { stakeholderId: req.params.id, firstName, lastName, position, email, phone, isPrimary: !!isPrimary },
    });
    res.status(201).json(c);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

// ── PATCH update contact ───────────────────────────────────────────────────
router.patch('/:id/contacts/:cid', async (req: Request, res: Response) => {
  const { firstName, lastName, position, email, phone, isPrimary } = req.body;
  try {
    if (isPrimary) {
      await prisma.stakeholderContact.updateMany({
        where: { stakeholderId: req.params.id, NOT: { id: req.params.cid } },
        data: { isPrimary: false },
      });
    }
    const c = await prisma.stakeholderContact.update({
      where: { id: req.params.cid },
      data: { firstName, lastName, position, email, phone, isPrimary: !!isPrimary },
    });
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// ── DELETE contact ─────────────────────────────────────────────────────────
router.delete('/:id/contacts/:cid', async (req: Request, res: Response) => {
  try {
    await prisma.stakeholderContact.delete({ where: { id: req.params.cid } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

export default router;
