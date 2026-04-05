import { prisma } from '../utils/db';

export const getAllProjects = async () => {
  return await prisma.project.findMany({
    where: { status: { not: 'ARCHIVED' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      projectNumber: true,
      name: true,
      location: true,
      totalValue: true,
      status: true,
      startDate: true,
      finishDate: true,
      durationMonths: true,
      metadata: true,
      _count: {
        select: {
          projectAssignments: true,
          materials: true
        }
      }
    }
  });
};

export const getProjectById = async (id: string) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      projectAssignments: {
        include: {
          employee: {
            select: { firstName: true, lastName: true, role: true }
          }
        }
      },
      materials: true,
      submittals: { select: { id: true, status: true, dueDate: true } },
      rfis: { select: { id: true, status: true, dateRaised: true, responseDate: true } },
      _count: {
        select: { materials: true, rfis: true, submittals: true, purchaseOrders: true }
      }
    }
  });
  
  if (!project) throw new Error('Project not found');

  // Compute SPI & CPI Simulation Health Profile natively here
  const today = new Date().getTime();
  const start = project.startDate ? new Date(project.startDate).getTime() : today;
  const finish = project.finishDate ? new Date(project.finishDate).getTime() : today;
       
  const totalDays = Math.max(1, (finish - start) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.max(0, (today - start) / (1000 * 60 * 60 * 24));
  let progressRatio = Math.min(1, Math.max(0, elapsedDays / totalDays));

  const pv = (project.totalValue || 0) * progressRatio;

  let lateMaterialsCount = 0;
  const projectMaterialCost = project.materials.reduce((sum, m) => {
    if (m.expectedDeliveryDate && new Date(m.expectedDeliveryDate).getTime() < today && m.status !== 'DELIVERED') lateMaterialsCount++;
    if (['SHIPPED', 'DELIVERED', 'INSTALLED'].includes(m.status)) return sum + (m.totalPrice || 0);
    return sum;
  }, 0);
  
  let overdueSubmittalsCount = project.submittals.filter(s => s.dueDate && new Date(s.dueDate).getTime() < today && s.status !== 'APPROVED').length;
  let unansweredRFIsCount = project.rfis.filter(r => ['DRAFT', 'SUBMITTED'].includes(r.status) && (today - new Date(r.dateRaised).getTime()) > 7*24*60*60*1000).length;

  const ac = projectMaterialCost + (project.miscCost || 0);

  let penalty = lateMaterialsCount * 0.05;
  if (penalty > 0.3) penalty = 0.3;
  const ev = (project.totalValue || 0) * (progressRatio * (1 - penalty));

  const spi = pv > 0 ? (ev / pv) : 1.0;
  const cpi = ac > 0 ? (ev / ac) : 1.0;

  return {
    ...project,
    health: { spi, cpi },
    alerts: { lateMaterialsCount, overdueSubmittalsCount, unansweredRFIsCount }
  };
};
