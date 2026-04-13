import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const emptySubmittals = await prisma.submittal.findMany({ 
    where: { 
      OR: [{ submittalNumber: '' }, { submittalNumber: 'N/A' }, { submittalNumber: 'n/a' }] 
    } 
  });
  console.log(`Found ${emptySubmittals.length} invalid Submittals.`);
  for (const s of emptySubmittals) {
    const maxSub = await prisma.submittal.findFirst({
      where: { projectId: s.projectId, NOT: { submittalNumber: { in: ['', 'N/A', 'n/a'] } } },
      orderBy: { submittalNumber: 'desc' }
    });
    let num = '';
    if (maxSub && maxSub.submittalNumber.startsWith('SUB-')) {
      const n = parseInt(maxSub.submittalNumber.replace('SUB-', ''), 10);
      num = `SUB-${String(n + 1).padStart(3, '0')}`;
    } else {
      const count = await prisma.submittal.count({ where: { projectId: s.projectId } });
      num = `SUB-${String(count + 1).padStart(3, '0')}`;
    }
    console.log(`Fixing Submittal ${s.id} -> ${num}`);
    await prisma.submittal.update({ where: { id: s.id }, data: { submittalNumber: num } });
  }

  const emptyRFIs = await prisma.rFI.findMany({ 
    where: { 
      OR: [{ rfiNumber: '' }, { rfiNumber: 'N/A' }, { rfiNumber: 'n/a' }] 
    } 
  });
  console.log(`Found ${emptyRFIs.length} invalid RFIs.`);
  for (const r of emptyRFIs) {
    const maxRfi = await prisma.rFI.findFirst({
      where: { projectId: r.projectId, NOT: { rfiNumber: { in: ['', 'N/A', 'n/a'] } } },
      orderBy: { rfiNumber: 'desc' }
    });
    let num = '';
    if (maxRfi && maxRfi.rfiNumber.startsWith('RFI-')) {
      const n = parseInt(maxRfi.rfiNumber.replace('RFI-', ''), 10);
      num = `RFI-${String(n + 1).padStart(3, '0')}`;
    } else {
      const count = await prisma.rFI.count({ where: { projectId: r.projectId } });
      num = `RFI-${String(count + 1).padStart(3, '0')}`;
    }
    console.log(`Fixing RFI ${r.id} -> ${num}`);
    await prisma.rFI.update({ where: { id: r.id }, data: { rfiNumber: num } });
  }
}

main().finally(() => prisma.$disconnect());
