import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/db';
import { logActivity } from '../utils/activityLogger';

const router = Router();
router.use(authenticate);

const include = {
  project: { select: { name: true, projectNumber: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  recipientContact: { 
    include: { stakeholder: { select: { name: true } } }
  }
};

// LIST
router.get('/', async (req, res, next) => {
  try {
    const where = req.query.projectId ? { projectId: String(req.query.projectId) } : {};
    res.json(await prisma.submittal.findMany({ where, orderBy: [{ submittalNumber: 'asc' }, { revisionNumber: 'asc' }], include }));
  } catch (err) { next(err); }
});

// GET ONE
router.get('/:id', async (req, res, next) => {
  try {
    const s = await prisma.submittal.findUnique({ where: { id: req.params.id }, include });
    if (!s) return res.status(404).json({ message: 'Submittal not found' });
    res.json(s);
  } catch (err) { next(err); }
});

// CREATE
router.post('/', async (req: any, res, next) => {
  try {
    const { projectId, submittalNumber, title, description, status, revisionNumber, submittedDate, dueDate, reviewDurationDays, notes, recipientContactId } = req.body;
    if (!projectId || !title)
      return res.status(400).json({ message: 'projectId and title are required' });

    let finalSubmittalNumber = submittalNumber ? String(submittalNumber).trim() : '';
    if (!finalSubmittalNumber || finalSubmittalNumber.toUpperCase() === 'N/A') {
      const maxSub = await prisma.submittal.findFirst({
        where: { projectId },
        orderBy: { submittalNumber: 'desc' }
      });
      if (maxSub && maxSub.submittalNumber.startsWith('SUB-')) {
        const num = parseInt(maxSub.submittalNumber.replace('SUB-', ''), 10);
        finalSubmittalNumber = `SUB-${String(num + 1).padStart(3, '0')}`;
      } else {
        const count = await prisma.submittal.count({ where: { projectId } });
        finalSubmittalNumber = `SUB-${String(count + 1).padStart(3, '0')}`;
      }
    } else if (!finalSubmittalNumber.startsWith('SUB-')) {
      finalSubmittalNumber = `SUB-${finalSubmittalNumber}`;
    }

    const created = await prisma.submittal.create({
      data: {
        projectId, submittalNumber: finalSubmittalNumber, title, description,
        status: status || 'DRAFT',
        createdById: req.user.id,
        revisionNumber: revisionNumber != null ? Number(revisionNumber) : 0,
        submittedDate: submittedDate ? new Date(submittedDate) : undefined,
        reviewDurationDays: reviewDurationDays != null ? Number(reviewDurationDays) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        notes,
        recipientContactId
      },
      include
    });
    await logActivity(req.user.id, 'CREATE', 'submittal', created.id, null, created);
    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'A submittal with this number and revision already exists on this project' });
    next(err);
  }
});

// UPDATE
router.patch('/:id', async (req: any, res, next) => {
  try {
    const before = await prisma.submittal.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ message: 'Submittal not found' });

    console.log(`PATCH Submittal ${req.params.id}:`, req.body);
    const { submittedDate, dueDate, approvedDate, reviewDurationDays, projectId, createdById, revisionNumber, ...rest } = req.body;
    const updated = await prisma.submittal.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(revisionNumber != null ? { revisionNumber: Number(revisionNumber) } : {}),
        ...(submittedDate ? { submittedDate: new Date(submittedDate) } : {}),
        ...(reviewDurationDays != null ? { reviewDurationDays: Number(reviewDurationDays) } : {}),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        ...(approvedDate ? { approvedDate: new Date(approvedDate) } : {}),
      },
      include
    });
    await logActivity(req.user.id, rest.status !== before.status ? 'STATUS_CHANGE' : 'UPDATE', 'submittal', req.params.id, before, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// NEW REVISION — clones submittal with revisionNumber + 1, status reset to DRAFT
router.post('/:id/revise', async (req: any, res, next) => {
  let source: any = null;
  try {
    source = await prisma.submittal.findUnique({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ message: 'Submittal not found' });

    const nextRev = source.revisionNumber + 1;
    const created = await prisma.submittal.create({
      data: {
        projectId: source.projectId,
        submittalNumber: source.submittalNumber,
        title: source.title,
        description: source.description ?? undefined,
        notes: source.notes ?? undefined,
        revisionNumber: nextRev,
        status: 'DRAFT',
        createdById: req.user.id,
        reviewDurationDays: source.reviewDurationDays ?? undefined,
        dueDate: source.dueDate ?? undefined,
        recipientContactId: source.recipientContactId
      },
      include
    });
    await logActivity(req.user.id, 'CREATE', 'submittal', created.id, null,
      { ...created, _revisedFrom: source.id, _revision: nextRev });
    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === 'P2002')
      return res.status(409).json({ message: `Revision ${source ? source.revisionNumber + 1 : '?'} already exists for this submittal` });
    next(err);
  }
});

// DELETE — only DRAFT
router.delete('/:id', async (req: any, res, next) => {
  try {
    const s = await prisma.submittal.findUnique({ where: { id: req.params.id } });
    if (!s) return res.status(404).json({ message: 'Submittal not found' });
    // Any submittal can be deleted
    await prisma.submittal.delete({ where: { id: req.params.id } });
    await logActivity(req.user.id, 'DELETE', 'submittal', req.params.id, s, null);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
