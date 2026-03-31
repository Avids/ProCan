import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.employee.count();
  console.log('Employee Count:', count);
  const admin = await prisma.employee.findUnique({
    where: { email: 'admin@procan.com' }
  });
  console.log('Admin found:', !!admin);
  if (admin) {
    console.log('Admin isActive:', admin.isActive);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
