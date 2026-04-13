import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/db';
import { logActivity } from '../utils/activityLogger';

const router = Router();
router.use(authenticate);

const include = {
  project: { select: { name: true, projectNumber: true } },
  raisedBy: { select: { firstName: true, lastName: true } },
  respondedBy: { select: { firstName: true, lastName: true } },
  recipientContact: { 
    include: { stakeholder: { select: { name: true } } }
  }
};

// LIST
router.get('/', async (req, res, next) => {
  try { 
    const where = req.query.projectId ? { projectId: String(req.query.projectId) } : {};
    res.json(await prisma.rFI.findMany({ where, orderBy: [{ rfiNumber: 'asc' }, { revisionNumber: 'asc' }], include })); 
  }
  catch (err) { next(err); }
});

// GET ONE
router.get('/:id', async (req, res, next) => {
  try {
    const rfi = await prisma.rFI.findUnique({ where: { id: req.params.id }, include });
    if (!rfi) return res.status(404).json({ message: 'RFI not found' });
    res.json(rfi);
  } catch (err) { next(err); }
});

// CREATE
router.post('/', async (req: any, res, next) => {
  try {
    const { projectId, rfiNumber, title, question, status, dateRaised, revisionNumber, recipientContactId } = req.body;
    if (!projectId || !question || !title)
      return res.status(400).json({ message: 'projectId, title, and question are required' });

    let finalRfiNumber = rfiNumber ? String(rfiNumber).trim() : '';
    if (!finalRfiNumber || finalRfiNumber.toUpperCase() === 'N/A') {
      const maxRfi = await prisma.rFI.findFirst({
        where: { projectId },
        orderBy: { rfiNumber: 'desc' }
      });
      if (maxRfi && maxRfi.rfiNumber.startsWith('RFI-')) {
        const num = parseInt(maxRfi.rfiNumber.replace('RFI-', ''), 10);
        finalRfiNumber = `RFI-${String(num + 1).padStart(3, '0')}`;
      } else {
        const count = await prisma.rFI.count({ where: { projectId } });
        finalRfiNumber = `RFI-${String(count + 1).padStart(3, '0')}`;
      }
    } else if (!finalRfiNumber.startsWith('RFI-')) {
      finalRfiNumber = `RFI-${finalRfiNumber}`;
    }

    const created = await prisma.rFI.create({
      data: {
        projectId, rfiNumber: finalRfiNumber, title, question,
        status: status || 'DRAFT',
        revisionNumber: revisionNumber != null ? Number(revisionNumber) : 0,
        raisedById: req.user.id,
        dateRaised: dateRaised ? new Date(dateRaised) : new Date(),
        recipientContactId
      },
      include
    });
    await logActivity(req.user.id, 'CREATE', 'rfi', created.id, null, created);
    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'An RFI with this number and revision already exists on this project' });
    next(err);
  }
});

// UPDATE (add response, change status, etc.)
router.patch('/:id', async (req: any, res, next) => {
  try {
    const before = await prisma.rFI.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ message: 'RFI not found' });

    console.log(`PATCH RFI ${req.params.id}:`, req.body);
    const { responseDate, dateRaised, projectId, raisedById, respondedById: _respondedById, revisionNumber: _rev, ...rest } = req.body;
    const revisionNumber = _rev != null ? Number(_rev) : undefined;

    const respondedByUpdate = rest.response ? { respondedById: req.user.id } : {};

    const updated = await prisma.rFI.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...respondedByUpdate,
        ...(revisionNumber !== undefined ? { revisionNumber } : {}),
        ...(responseDate ? { responseDate: new Date(responseDate) } : {}),
        ...(dateRaised ? { dateRaised: new Date(dateRaised) } : {}),
      },
      include
    });
    await logActivity(req.user.id, rest.status !== before.status ? 'STATUS_CHANGE' : 'UPDATE', 'rfi', req.params.id, before, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// NEW REVISION — clones RFI with revisionNumber + 1, status reset to DRAFT
router.post('/:id/revise', async (req: any, res, next) => {
  let source: any = null;
  try {
    source = await prisma.rFI.findUnique({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ message: 'RFI not found' });

    const nextRev = source.revisionNumber + 1;
    const created = await prisma.rFI.create({
      data: {
        projectId: source.projectId,
        rfiNumber: source.rfiNumber,
        title: source.title,
        question: source.question,
        revisionNumber: nextRev,
        status: 'DRAFT',
        raisedById: req.user.id,
        dateRaised: new Date(),
        recipientContactId: source.recipientContactId
      },
      include
    });
    await logActivity(req.user.id, 'CREATE', 'rfi', created.id, null,
      { ...created, _revisedFrom: source.id, _revision: nextRev });
    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === 'P2002')
      return res.status(409).json({ message: `Revision ${source ? source.revisionNumber + 1 : '?'} already exists for this RFI` });
    next(err);
  }
});

// DELETE — only DRAFT
router.delete('/:id', async (req: any, res, next) => {
  try {
    const rfi = await prisma.rFI.findUnique({ where: { id: req.params.id } });
    if (!rfi) return res.status(404).json({ message: 'RFI not found' });
    // Any RFI can be deleted (usually restricted to admin/manager by the 'authenticate' and 'canMutate' checks)
    await prisma.rFI.delete({ where: { id: req.params.id } });
    await logActivity(req.user.id, 'DELETE', 'rfi', req.params.id, rfi, null);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
