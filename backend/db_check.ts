import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
const prisma = new PrismaClient();

async function main() {
  let output = '';
  try {
    const count = await prisma.employee.count();
    output += `Employee Count: ${count}\n`;
    
    const admin = await prisma.employee.findUnique({
      where: { email: 'admin@procan.com' }
    });
    output += `Admin found: ${!!admin}\n`;
    if (admin) {
      output += `Admin ID: ${admin.id}\n`;
      output += `Admin isActive: ${admin.isActive}\n`;
      output += `Admin Role: ${admin.role}\n`;
    }
  } catch (e: any) {
    output += `ERROR: ${e.message}\n`;
  } finally {
    fs.writeFileSync('db_check_result.txt', output);
    await prisma.$disconnect();
  }
}

main();
