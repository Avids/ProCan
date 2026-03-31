import { prisma } from '../utils/db';

export const getAllMaterials = async () => {
  return await prisma.material.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      vendor: { select: { companyName: true } },
      project: { select: { projectNumber: true, name: true } }
    }
  });
};

export const getMaterialById = async (id: string) => {
  const material = await prisma.material.findUnique({
    where: { id },
    include: {
      vendor: { select: { companyName: true, contactPerson: true, phone: true } },
      project: true,
      purchaseOrder: { select: { poNumber: true, status: true, poDate: true } }
    }
  });
  if (!material) throw new Error('Material not found');
  return material;
};
