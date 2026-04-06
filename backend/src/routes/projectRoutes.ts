import { Router } from 'express';
import { getProjects, getProject } from '../controllers/projectController';
import { authenticate, authorizeRole } from '../middleware/auth';
import { prisma } from '../utils/db';
import { logActivity } from '../utils/activityLogger';

const router = Router();
router.use(authenticate);

router.get('/', getProjects);
router.get('/:id', getProject);

// ── Helper: stakeholder include fragment ──────────────────────────────────────
const stakeholderInclude = {
  owner:     { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
  gc:        { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
  architect: { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
  engineer:  { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
};

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/', authorizeRole(['COMPANY_MANAGER', 'PROJECT_MANAGER']), async (req: any, res, next) => {
  try {
    const {
      projectNumber, name, location, description,
      ownerId, gcId, architectId, engineerId,
      totalValue, durationMonths, startDate, finishDate,
      status, laborHours, laborValue, materialCost, managerId
    } = req.body;

    if (!projectNumber || !name || totalValue == null || durationMonths == null)
      return res.status(400).json({ message: 'projectNumber, name, totalValue, and durationMonths are required' });

    const project = await prisma.project.create({
      data: {
        projectNumber, name, location, description,
        ownerId:     ownerId     || null,
        gcId:        gcId        || null,
        architectId: architectId || null,
        engineerId:  engineerId  || null,
        totalValue: Number(totalValue),
        durationMonths: Number(durationMonths),
        laborHours:   laborHours   != null ? Number(laborHours)   : undefined,
        laborValue:   laborValue   != null ? Number(laborValue)   : undefined,
        materialCost: materialCost != null ? Number(materialCost) : undefined,
        startDate:  startDate  ? new Date(startDate)  : undefined,
        finishDate: finishDate ? new Date(finishDate) : undefined,
        status: status || 'PLANNING',
      },
      include: stakeholderInclude,
    });

    if (managerId) {
      await prisma.projectAssignment.create({
        data: {
          projectId: project.id,
          employeeId: managerId,
          positionInProject: 'Project Manager',
          moduleAccess: 'ALL',
          assignedById: req.user.id,
        },
      });
    }

    await logActivity(req.user.id, 'CREATE', 'project', project.id, null, project);
    res.status(201).json(project);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Project number already exists' });
    next(err);
  }
});

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.patch('/:id', authorizeRole(['COMPANY_MANAGER', 'PROJECT_MANAGER']), async (req: any, res, next) => {
  try {
    const before = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ message: 'Project not found' });

    const {
      totalValue, durationMonths, startDate, finishDate, actualStartDate, actualFinishDate,
      laborHours, laborValue, materialCost, managerId, evmData,
      ownerId, gcId, architectId, engineerId,
      // strip old metadata stakeholder strings if still sent
      generalContractorName: _gcn, ownerName: _on, architectName: _an, engineerName: _en,
      ...rest
    } = req.body;

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(evmData !== undefined ? { evmData } : {}),
        ...(ownerId     !== undefined ? { ownerId:     ownerId     || null } : {}),
        ...(gcId        !== undefined ? { gcId:        gcId        || null } : {}),
        ...(architectId !== undefined ? { architectId: architectId || null } : {}),
        ...(engineerId  !== undefined ? { engineerId:  engineerId  || null } : {}),
        ...(totalValue    != null ? { totalValue:    Number(totalValue)    } : {}),
        ...(durationMonths != null ? { durationMonths: Number(durationMonths) } : {}),
        ...(laborHours    != null ? { laborHours:    Number(laborHours)    } : {}),
        ...(laborValue    != null ? { laborValue:    Number(laborValue)    } : {}),
        ...(materialCost  != null ? { materialCost:  Number(materialCost)  } : {}),
        ...(startDate  ? { startDate:  new Date(startDate)  } : {}),
        ...(finishDate ? { finishDate: new Date(finishDate) } : {}),
        ...(actualStartDate  ? { actualStartDate:  new Date(actualStartDate)  } : {}),
        ...(actualFinishDate ? { actualFinishDate: new Date(actualFinishDate) } : {}),
      },
      include: stakeholderInclude,
    });

    if (managerId !== undefined) {
      const existing = await prisma.projectAssignment.findFirst({
        where: { projectId: updated.id, positionInProject: 'Project Manager' },
      });
      if (!managerId && existing) {
        await prisma.projectAssignment.delete({ where: { id: existing.id } });
      } else if (managerId && !existing) {
        await prisma.projectAssignment.create({
          data: { projectId: updated.id, employeeId: managerId, positionInProject: 'Project Manager', moduleAccess: 'ALL', assignedById: req.user.id },
        });
      } else if (managerId && existing && existing.employeeId !== managerId) {
        await prisma.projectAssignment.update({ where: { id: existing.id }, data: { employeeId: managerId } });
      }
    }

    await logActivity(req.user.id, 'UPDATE', 'project', req.params.id, before, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/:id', authorizeRole(['COMPANY_MANAGER']), async (req: any, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { materials: { where: { status: { notIn: ['REJECTED'] } }, select: { id: true } } },
    });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.materials.length > 0)
      return res.status(409).json({ message: 'Cannot delete project with active materials on record' });

    await prisma.project.delete({ where: { id: req.params.id } });
    await logActivity(req.user.id, 'DELETE', 'project', req.params.id, project, null);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── ASSIGN employee ───────────────────────────────────────────────────────────
router.post('/:id/assign', authorizeRole(['COMPANY_MANAGER', 'PROJECT_MANAGER']), async (req: any, res, next) => {
  try {
    const { employeeId, positionInProject, moduleAccess } = req.body;
    if (!employeeId) return res.status(400).json({ message: 'employeeId is required' });
    const assignment = await prisma.projectAssignment.create({
      data: { projectId: req.params.id, employeeId, positionInProject, moduleAccess: moduleAccess || 'ALL', assignedById: req.user.id },
      include: { employee: { select: { firstName: true, lastName: true, role: true } } },
    });
    await logActivity(req.user.id, 'CREATE', 'project_assignment', assignment.id, null, assignment);
    res.status(201).json(assignment);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Employee is already assigned to this project' });
    next(err);
  }
});

// ── REMOVE assignment ──────────────────────────────────────────────────────────
router.delete('/:id/assign/:assignmentId', authorizeRole(['COMPANY_MANAGER', 'PROJECT_MANAGER']), async (req: any, res, next) => {
  try {
    const assignment = await prisma.projectAssignment.findUnique({ where: { id: req.params.assignmentId } });
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    await prisma.projectAssignment.delete({ where: { id: req.params.assignmentId } });
    await logActivity(req.user.id, 'DELETE', 'project_assignment', req.params.assignmentId, assignment, null);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
