import { PrismaClient, VendorTradeType, ProjectStatus, PurchaseOrderStatus, MaterialStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting dummy data database seed...');

  // 1. Create Employees (Admin & Project Manager)
  const dummyPasswordHash = '$2b$10$fBH7ZaFvc4BrlzfGOdGPxOXF6adexXC/XqBey0EXxshVDdswzhXke';

  const admin = await prisma.employee.upsert({
    where: { email: 'admin@procan.com' },
    update: {},
    create: {
      email: 'admin@procan.com',
      password: dummyPasswordHash,
      firstName: 'System',
      lastName: 'Admin',
      position: 'ADMIN',
      role: 'COMPANY_MANAGER',
    },
  });

  const pm = await prisma.employee.upsert({
    where: { email: 'pm@procan.com' },
    update: {},
    create: {
      email: 'pm@procan.com',
      password: dummyPasswordHash,
      firstName: 'John',
      lastName: 'Doe',
      position: 'PROJECT_MANAGER',
      role: 'PROJECT_MANAGER',
    },
  });

  console.log('✅ Created Employees');

  // 2. Create Vendors (Subcontractor & Supplier)
  const subVendor = await prisma.vendor.upsert({
    where: { id: 'acme-structural-id' }, // Using a fixed ID for idempotency or checking by name
    update: {},
    create: {
      id: 'acme-structural-id',
      companyName: 'Acme Structural Steel',
      contactPerson: 'Bob Builder',
      phone: '555-0100',
      email: 'bob@acmesteel.com',
      isSubcontractor: true,
      tradeType: 'STRUCTURAL',
    },
  });

  const supplierVendor = await prisma.vendor.upsert({
    where: { id: 'buildmart-finishes-id' },
    update: {},
    create: {
      id: 'buildmart-finishes-id',
      companyName: 'BuildMart Finishes',
      contactPerson: 'Alice Supplier',
      phone: '555-0200',
      email: 'alice@buildmart.com',
      isSubcontractor: false,
      tradeType: 'FINISHES',
    },
  });

  console.log('✅ Created Vendors');

  // 3. Create Project
  const project = await prisma.project.upsert({
    where: { projectNumber: 'PRJ-2026-001' },
    update: {},
    create: {
      projectNumber: 'PRJ-2026-001',
      name: 'Project Alpha Tower',
      location: '123 Construction Blvd',
      totalValue: 5000000,
      durationMonths: 12,
      status: 'ACTIVE',
      startDate: new Date(),
    },
  });

  console.log('✅ Created Project:', project.projectNumber);

  // 4. Create Project Assignment
  await prisma.projectAssignment.upsert({
    where: { employeeId_projectId: { employeeId: pm.id, projectId: project.id } },
    update: {},
    create: {
      employeeId: pm.id,
      projectId: project.id,
      positionInProject: 'Lead PM',
      moduleAccess: 'ALL',
      assignedById: admin.id,
    },
  });

  console.log('✅ Linked PM to Project');

  // 5. Create Purchase Order & Material
  const poCount = await prisma.purchaseOrder.count({ where: { poNumber: 'PO-2026-1001' } });
  if (poCount === 0) {
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: 'PO-2026-1001',
        vendorId: supplierVendor.id,
        projectId: project.id,
        totalAmount: 15000,
        status: 'ISSUED',
        notes: 'Initial bulk order of concrete cement.',
      },
    });

    await prisma.material.create({
      data: {
        poId: po.id,
        projectId: project.id,
        vendorId: supplierVendor.id,
        description: 'High-grade Structural Cement',
        quantity: 500,
        unit: 'Bags',
        unitPrice: 30,
        totalPrice: 15000,
        status: 'SHIPPED',
        systemCategory: 'STRUCTURAL',
      },
    });
    console.log('✅ Created PO and Material tracking records');
  }

  console.log('🎉 Seeding successfully finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
