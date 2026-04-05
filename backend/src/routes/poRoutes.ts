import { Router } from 'express';
import { authenticate, authorizeRole } from '../middleware/auth';
import { prisma } from '../utils/db';
import { logActivity } from '../utils/activityLogger';

const router = Router();
router.use(authenticate);

// LIST
router.get('/', async (req, res, next) => {
  try {
    const where = req.query.projectId ? { projectId: String(req.query.projectId) } : {};
    const data = await prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { id: true, companyName: true } },
        project: { select: { name: true, projectNumber: true } }
      }
    });
    res.json(data);
  } catch (err) { next(err); }
});

// GET ONE
router.get('/:id', async (req, res, next) => {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: {
        vendor: true, project: { select: { name: true } },
        materials: true
      }
    });
    if (!po) return res.status(404).json({ message: 'Purchase Order not found' });
    res.json(po);
  } catch (err) { next(err); }
});

// CREATE
router.post('/', async (req: any, res, next) => {
  try {
    const { poNumber, vendorId, projectId, totalAmount, status, poDate, notes } = req.body;
    if (!poNumber || !vendorId || !projectId || totalAmount == null)
      return res.status(400).json({ message: 'poNumber, vendorId, projectId, and totalAmount are required' });

    const po = await prisma.purchaseOrder.create({
      data: { poNumber, vendorId, projectId, totalAmount: Number(totalAmount), status: status || 'DRAFT', poDate: poDate ? new Date(poDate) : new Date(), notes },
      include: { vendor: { select: { companyName: true } }, project: { select: { name: true } } }
    });
    await logActivity(req.user.id, 'CREATE', 'purchase_order', po.id, null, po);
    res.status(201).json(po);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'PO number already exists' });
    next(err);
  }
});

// UPDATE
router.patch('/:id', async (req: any, res, next) => {
  try {
    const before = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ message: 'Purchase Order not found' });

    const { totalAmount, poDate, ...rest } = req.body;
    const updated = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(totalAmount != null ? { totalAmount: Number(totalAmount) } : {}),
        ...(poDate ? { poDate: new Date(poDate) } : {})
      },
      include: { vendor: { select: { companyName: true } }, project: { select: { name: true } } }
    });
    await logActivity(req.user.id, 'UPDATE', 'purchase_order', req.params.id, before, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE — only DRAFT or CANCELLED, restricted to CM/PM
router.delete('/:id', authorizeRole(['COMPANY_MANAGER', 'PROJECT_MANAGER']), async (req: any, res, next) => {
  try {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!po) return res.status(404).json({ message: 'Purchase Order not found' });
    if (!['DRAFT', 'CANCELLED'].includes(po.status))
      return res.status(409).json({ message: 'Only DRAFT or CANCELLED Purchase Orders can be deleted' });
    await prisma.purchaseOrder.delete({ where: { id: req.params.id } });
    await logActivity(req.user.id, 'DELETE', 'purchase_order', req.params.id, po, null);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
