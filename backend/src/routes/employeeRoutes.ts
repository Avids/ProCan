import { Router } from 'express';
import { authenticate, authorizeRole } from '../middleware/auth';
import { prisma } from '../utils/db';
import { logActivity } from '../utils/activityLogger';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

const select = { id: true, firstName: true, lastName: true, email: true, role: true, position: true, isActive: true, phone: true, createdAt: true };

// LIST
router.get('/', async (req, res, next) => {
  try { res.json(await prisma.employee.findMany({ select, orderBy: { firstName: 'asc' } })); }
  catch (err) { next(err); }
});

// GET ONE
router.get('/:id', async (req, res, next) => {
  try {
    const e = await prisma.employee.findUnique({ where: { id: req.params.id }, select });
    if (!e) return res.status(404).json({ message: 'Employee not found' });
    res.json(e);
  } catch (err) { next(err); }
});

// CREATE — Company Manager only
router.post('/', authorizeRole(['COMPANY_MANAGER']), async (req: any, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, position, role } = req.body;
    if (!email || !password || !firstName || !lastName || !position || !role)
      return res.status(400).json({ message: 'email, password, firstName, lastName, position, and role are required' });

    const hashed = await bcrypt.hash(password, 10);
    const employee = await prisma.employee.create({
      data: { email, password: hashed, firstName, lastName, phone, position, role },
      select
    });
    await logActivity(req.user.id, 'CREATE', 'employee', employee.id, null, { ...employee });
    res.status(201).json(employee);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Email already registered' });
    next(err);
  }
});

// UPDATE — Company Manager only (role, position, phone, isActive)
router.patch('/:id', authorizeRole(['COMPANY_MANAGER']), async (req: any, res, next) => {
  try {
    const before = await prisma.employee.findUnique({ where: { id: req.params.id }, select });
    if (!before) return res.status(404).json({ message: 'Employee not found' });

    const { password, ...rest } = req.body; // ignore password changes here (separate endpoint later)
    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data: rest,
      select
    });
    await logActivity(req.user.id, 'UPDATE', 'employee', req.params.id, before, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE (soft) — Company Manager only
router.delete('/:id', authorizeRole(['COMPANY_MANAGER']), async (req: any, res, next) => {
  try {
    const before = await prisma.employee.findUnique({ where: { id: req.params.id }, select });
    if (!before) return res.status(404).json({ message: 'Employee not found' });

    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data: { isActive: false },
      select
    });
    await logActivity(req.user.id, 'DELETE', 'employee', req.params.id, before, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
