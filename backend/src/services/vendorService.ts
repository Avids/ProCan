import { prisma } from '../utils/db';

export const getAllVendors = async () => {
  return await prisma.vendor.findMany({
    orderBy: { companyName: 'asc' },
    select: {
      id: true,
      companyName: true,
      contactPerson: true,
      phone: true,
      email: true,
      isSubcontractor: true,
      tradeType: true
    }
  });
};

export const getVendorById = async (id: string) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      purchaseOrders: { select: { poNumber: true, status: true, totalAmount: true, poDate: true } }
    }
  });
  if (!vendor) throw new Error('Vendor not found');
  return vendor;
};

export const createVendor = async (data: {
  companyName: string; contactPerson: string; phone: string; email: string;
  address?: string; taxId?: string; notes?: string; isSubcontractor?: boolean; tradeType?: string;
}) => {
  return await prisma.vendor.create({ data: data as any });
};

export const updateVendor = async (id: string, data: Partial<{
  companyName: string; contactPerson: string; phone: string; email: string;
  address: string; taxId: string; notes: string; isSubcontractor: boolean; tradeType: string;
}>) => {
  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) throw new Error('Vendor not found');
  return await prisma.vendor.update({ where: { id }, data: data as any });
};

export const deleteVendor = async (id: string) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      purchaseOrders: { where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } }, select: { id: true } },
      materials: { where: { status: { notIn: ['REJECTED'] } }, select: { id: true } }
    }
  });
  if (!vendor) throw new Error('Vendor not found');
  if (vendor.purchaseOrders.length > 0)
    throw new Error('Cannot delete vendor with active Purchase Orders. Cancel them first.');
  if (vendor.materials.length > 0)
    throw new Error('Cannot delete vendor with active Materials on record.');
  return await prisma.vendor.delete({ where: { id } });
};

