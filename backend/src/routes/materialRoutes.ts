import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/db';
import { logActivity } from '../utils/activityLogger';

const router = Router();
router.use(authenticate);

const include = {
  vendor: { select: { companyName: true } },
  project: { select: { name: true, projectNumber: true } },
  purchaseOrder: { select: { poNumber: true } }
};

// LIST
router.get('/', async (req, res, next) => {
  try {
    const where = req.query.projectId ? { projectId: String(req.query.projectId) } : {};
    res.json(await prisma.material.findMany({ where, orderBy: { expectedDeliveryDate: 'asc' }, include }));
  } catch (err) { next(err); }
});

// GET ONE
router.get('/:id', async (req, res, next) => {
  try {
    const m = await prisma.material.findUnique({ where: { id: req.params.id }, include });
    if (!m) return res.status(404).json({ message: 'Material not found' });
    res.json(m);
  } catch (err) { next(err); }
});

// CREATE
router.post('/', async (req: any, res, next) => {
  try {
    const { poId, projectId, vendorId, description, quantity, unit, unitPrice, totalPrice,
      status, releasedDate, leadTimeWeeks, expectedDeliveryDate, shopDrawingStatus,
      systemCategory, notes, drawingReference, location } = req.body;

    if (!projectId || !description || quantity == null || !unit)
      return res.status(400).json({ message: 'projectId, description, quantity, and unit are required' });

    const created = await prisma.material.create({
      data: {
        projectId,
        description,
        quantity: Number(quantity),
        unit,
        poId: poId || null,
        vendorId: vendorId || null,
        unitPrice: unitPrice != null ? Number(unitPrice) : undefined,
        totalPrice: totalPrice != null ? Number(totalPrice) : (unitPrice != null ? Number(unitPrice) * Number(quantity) : undefined),
        status: status || 'ORDERED',
        shopDrawingStatus: shopDrawingStatus || 'NOT_SUBMITTED',
        systemCategory: systemCategory || 'OTHER',
        leadTimeWeeks: leadTimeWeeks ? Number(leadTimeWeeks) : undefined,
        releasedDate: releasedDate ? new Date(releasedDate) : undefined,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
        notes: notes || undefined,
        drawingReference: drawingReference || undefined,
        location: location || undefined,
      },
      include
    });
    await logActivity(req.user.id, 'CREATE', 'material', created.id, null, created);
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// UPDATE
router.patch('/:id', async (req: any, res, next) => {
  try {
    const before = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ message: 'Material not found' });

    const { quantity, unitPrice, totalPrice, leadTimeWeeks,
      releasedDate, expectedDeliveryDate, actualDeliveryDate,
      projectId, vendorId, poId, ...rest } = req.body;

    const updated = await prisma.material.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(projectId ? { projectId } : {}),
        ...(poId !== undefined ? { poId: poId || null } : {}),
        ...(vendorId !== undefined ? { vendorId: vendorId || null } : {}),
        ...(quantity != null ? { quantity: Number(quantity) } : {}),
        ...(unitPrice != null ? { unitPrice: Number(unitPrice) } : {}),
        ...(totalPrice != null ? { totalPrice: Number(totalPrice) } : {}),
        ...(leadTimeWeeks != null ? { leadTimeWeeks: Number(leadTimeWeeks) } : {}),
        ...(releasedDate ? { releasedDate: new Date(releasedDate) } : {}),
        ...(expectedDeliveryDate ? { expectedDeliveryDate: new Date(expectedDeliveryDate) } : {}),
        ...(actualDeliveryDate ? { actualDeliveryDate: new Date(actualDeliveryDate) } : {}),
      },
      include
    });
    await logActivity(req.user.id, rest.status !== before.status ? 'STATUS_CHANGE' : 'UPDATE', 'material', req.params.id, before, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE — blocked if DELIVERED or INSTALLED
router.delete('/:id', async (req: any, res, next) => {
  try {
    const m = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!m) return res.status(404).json({ message: 'Material not found' });
    if (['DELIVERED', 'INSTALLED'].includes(m.status))
      return res.status(409).json({ message: `Cannot delete a material with status ${m.status}` });
    await prisma.material.delete({ where: { id: req.params.id } });
    await logActivity(req.user.id, 'DELETE', 'material', req.params.id, m, null);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
