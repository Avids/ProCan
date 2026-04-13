import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const emptySubmittals = await prisma.submittal.findMany({ where: { submittalNumber: '' } });
  for (const s of emptySubmittals) {
    const count = await prisma.submittal.count({ where: { projectId: s.projectId } });
    const num = `SUB-${String(count + 1).padStart(3, '0')}`;
    console.log(`Fixing Submittal ${s.id} -> ${num}`);
    await prisma.submittal.update({ where: { id: s.id }, data: { submittalNumber: num } });
  }

  const emptyRFIs = await prisma.rFI.findMany({ where: { rfiNumber: '' } });
  for (const r of emptyRFIs) {
    const count = await prisma.rFI.count({ where: { projectId: r.projectId } });
    const num = `RFI-${String(count + 1).padStart(3, '0')}`;
    console.log(`Fixing RFI ${r.id} -> ${num}`);
    await prisma.rFI.update({ where: { id: r.id }, data: { rfiNumber: num } });
  }
}

main().finally(() => prisma.$disconnect());
