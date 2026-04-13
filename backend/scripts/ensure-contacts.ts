import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stakeholders = await prisma.stakeholder.findMany({
    include: { contacts: true }
  });

  for (const s of stakeholders) {
    if (s.contacts.length === 0) {
      console.log(`Creating primary contact for ${s.name}`);
      await prisma.stakeholderContact.create({
        data: {
          stakeholderId: s.id,
          firstName: 'General',
          lastName: 'Contact',
          email: s.email || 'office@example.com',
          isPrimary: true
        }
      });
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
